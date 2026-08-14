import { getGoogleAccessToken } from "./firebase";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_NAME = "DareStake Proofs";

/**
 * Find or create the DareStake Proofs folder in the user's Google Drive.
 */
async function findOrCreateFolder(
  accessToken: string,
  folderName: string = FOLDER_NAME
): Promise<string> {
  // Search for existing folder
  const searchParams = new URLSearchParams({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name)",
    spaces: "drive",
  });

  const searchRes = await fetch(`${DRIVE_API}/files?${searchParams}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchRes.ok) {
    throw new Error(`Drive API search failed: ${searchRes.status}`);
  }

  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder if not exists
  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Drive API folder creation failed: ${createRes.status}`);
  }

  const createData = await createRes.json();
  return createData.id;
}

/**
 * Upload a photo proof to Google Drive in the DareStake Proofs folder.
 * Returns the file ID and web view link.
 */
export async function uploadProofPhoto(
  file: File,
  taskId: string,
  taskTitle: string,
  onProgress?: (progress: number) => void
): Promise<{ fileId: string; fileUrl: string }> {
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    throw new Error(
      "Google Drive access not available. Please sign in again to grant Drive access."
    );
  }

  // Find or create the folder
  const folderId = await findOrCreateFolder(accessToken);

  // Generate a descriptive filename
  const timestamp = new Date().toISOString().split("T")[0];
  const sanitizedTitle = taskTitle.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
  const extension = file.name.split(".").pop() || "jpg";
  const fileName = `proof_${sanitizedTitle}_${timestamp}_${taskId.slice(0, 6)}.${extension}`;

  // Use multipart upload for simplicity
  const metadata = {
    name: fileName,
    parents: [folderId],
    description: `Task proof: "${taskTitle}" (ID: ${taskId}) - ${timestamp}`,
  };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append("file", file);

  // Simulate progress for UX (actual XHR progress would need XMLHttpRequest)
  onProgress?.(10);

  const uploadRes = await fetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,webViewLink,thumbnailLink`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );

  onProgress?.(80);

  if (!uploadRes.ok) {
    const errorData = await uploadRes.json().catch(() => ({}));
    throw new Error(
      `Upload failed: ${uploadRes.status} - ${JSON.stringify(errorData)}`
    );
  }

  const uploadData = await uploadRes.json();
  onProgress?.(100);

  // Make the file readable via link
  await fetch(`${DRIVE_API}/files/${uploadData.id}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role: "reader",
      type: "anyone",
    }),
  });

  return {
    fileId: uploadData.id,
    fileUrl:
      uploadData.webViewLink ||
      `https://drive.google.com/file/d/${uploadData.id}/view`,
  };
}

/**
 * Get a thumbnail URL for a Drive file.
 */
export async function getProofPhoto(
  fileId: string
): Promise<{ thumbnailUrl: string; viewUrl: string }> {
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    // Return a direct link even without token (file is shared publicly)
    return {
      thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`,
      viewUrl: `https://drive.google.com/file/d/${fileId}/view`,
    };
  }

  const res = await fetch(
    `${DRIVE_API}/files/${fileId}?fields=thumbnailLink,webViewLink`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    return {
      thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`,
      viewUrl: `https://drive.google.com/file/d/${fileId}/view`,
    };
  }

  const data = await res.json();
  return {
    thumbnailUrl:
      data.thumbnailLink ||
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`,
    viewUrl:
      data.webViewLink ||
      `https://drive.google.com/file/d/${fileId}/view`,
  };
}
