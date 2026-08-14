"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { uploadProofPhoto, getProofPhoto } from "@/lib/google-drive";

interface PhotoProofProps {
  taskId: string;
  taskTitle: string;
  existingProofId?: string;
  existingProofUrl?: string;
  onProofUploaded: (fileId: string, fileUrl: string) => void;
  disabled?: boolean;
}

export default function PhotoProof({
  taskId,
  taskTitle,
  existingProofId,
  existingProofUrl,
  onProofUploaded,
  disabled = false,
}: PhotoProofProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing proof thumbnail
  useEffect(() => {
    if (existingProofId) {
      getProofPhoto(existingProofId).then(({ thumbnailUrl }) => {
        setThumbnailUrl(thumbnailUrl);
      });
    }
  }, [existingProofId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be under 10MB");
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      const { fileId, fileUrl } = await uploadProofPhoto(
        file,
        taskId,
        taskTitle,
        setProgress
      );

      setThumbnailUrl(URL.createObjectURL(file));
      onProofUploaded(fileId, fileUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    if (disabled || uploading) return;
    if (thumbnailUrl || existingProofId) {
      setShowPreview(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleRetake = () => {
    setShowPreview(false);
    fileInputRef.current?.click();
  };

  // If proof already exists, show thumbnail
  if ((existingProofId || thumbnailUrl) && !uploading) {
    return (
      <>
        <button
          onClick={handleClick}
          className="relative group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-400/50 transition-all"
          title="View proof photo"
        >
          <svg
            className="w-4 h-4 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span className="text-xs text-emerald-300 font-medium">Proof ✓</span>
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt="Proof"
              className="w-6 h-6 rounded object-cover border border-emerald-500/30"
            />
          )}
        </button>

        {/* Preview modal */}
        <AnimatePresence>
          {showPreview && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
              onClick={() => setShowPreview(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative max-w-sm w-full rounded-2xl overflow-hidden border border-[#FF6B35]/30 bg-zinc-900"
                onClick={(e) => e.stopPropagation()}
              >
                {thumbnailUrl && (
                  <img
                    src={thumbnailUrl}
                    alt="Task proof"
                    className="w-full aspect-square object-cover"
                  />
                )}
                <div className="p-4 flex items-center justify-between">
                  <p className="text-xs text-zinc-400">Proof for: {taskTitle}</p>
                  <div className="flex gap-2">
                    {existingProofUrl && (
                      <a
                        href={existingProofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-300 text-xs hover:bg-blue-500/30 transition-colors"
                      >
                        Open in Drive
                      </a>
                    )}
                    {!disabled && (
                      <button
                        onClick={handleRetake}
                        className="px-3 py-1 rounded-lg bg-[#FF6B35]/20 text-[#FF6B35] text-xs hover:bg-[#FF6B35]/30 transition-colors"
                      >
                        Retake
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className="relative inline-flex items-center">
      {/* Hidden file input -- accepts images, prefers camera on mobile */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Camera button */}
      <button
        onClick={handleClick}
        disabled={disabled || uploading}
        className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#FF6B35]/30 bg-[#FF6B35]/10 hover:bg-[#FF6B35]/20 hover:border-[#FF6B35]/50 text-[#FF6B35] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        title="Add photo proof"
      >
        {uploading ? (
          <>
            <svg
              className="animate-spin h-4 w-4 text-[#FF6B35]"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-xs font-medium">{progress}%</span>
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="text-xs font-medium">Proof</span>
          </>
        )}
      </button>

      {/* Upload progress bar */}
      {uploading && (
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          className="absolute -bottom-1.5 left-0 right-0 h-0.5 rounded-full overflow-hidden bg-[#FF6B35]/20"
        >
          <motion.div
            className="h-full bg-[#FF6B35] rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </motion.div>
      )}

      {/* Error tooltip */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute top-full left-0 mt-2 px-3 py-1.5 rounded-lg bg-red-950/90 border border-red-500/30 text-red-300 text-xs whitespace-nowrap z-10"
          >
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-400 hover:text-red-200"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
