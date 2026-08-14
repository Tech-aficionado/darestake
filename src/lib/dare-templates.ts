export interface DareTemplate {
  emoji: string;
  title: string;
}

export interface DareCategory {
  id: string;
  label: string;
  emoji: string;
  templates: DareTemplate[];
}

export const dareCategories: DareCategory[] = [
  {
    id: "fitness",
    label: "Fitness",
    emoji: "💪",
    templates: [
      { emoji: "🏋️", title: "Do 50 push-ups" },
      { emoji: "🏃", title: "Run 2km without stopping" },
      { emoji: "🧘", title: "Hold a plank for 2 minutes" },
      { emoji: "⬆️", title: "Do 100 squats throughout the day" },
      { emoji: "🤸", title: "Complete a 20-min HIIT workout" },
      { emoji: "🚶", title: "Walk 10,000 steps today" },
      { emoji: "💪", title: "Do 30 burpees" },
      { emoji: "🏊", title: "Stretch for 15 minutes" },
    ],
  },
  {
    id: "productivity",
    label: "Productivity",
    emoji: "⚡",
    templates: [
      { emoji: "📵", title: "No social media for 4 hours" },
      { emoji: "📖", title: "Read 30 pages of a book" },
      { emoji: "✍️", title: "Write 500 words (journal/blog/notes)" },
      { emoji: "🧹", title: "Clean and organize your desk" },
      { emoji: "📋", title: "Finish your most dreaded task first" },
      { emoji: "⏰", title: "Wake up before 6 AM" },
      { emoji: "🎯", title: "Complete 3 Pomodoro sessions" },
    ],
  },
  {
    id: "health",
    label: "Health",
    emoji: "🥗",
    templates: [
      { emoji: "💧", title: "Drink 3 litres of water" },
      { emoji: "🥗", title: "Eat only home-cooked meals today" },
      { emoji: "🚫", title: "No sugar or junk food today" },
      { emoji: "😴", title: "Sleep before 11 PM tonight" },
      { emoji: "🧘", title: "Meditate for 10 minutes" },
      { emoji: "🍎", title: "Eat 3 servings of fruits/vegetables" },
      { emoji: "☕", title: "No caffeine after 2 PM" },
      { emoji: "📱", title: "No screens 1 hour before bed" },
    ],
  },
  {
    id: "social",
    label: "Social",
    emoji: "🤝",
    templates: [
      { emoji: "📞", title: "Call a family member you haven't spoken to" },
      { emoji: "💬", title: "Compliment 3 people genuinely" },
      { emoji: "🙏", title: "Send a thank-you message to someone" },
      { emoji: "🤝", title: "Help a stranger or colleague today" },
      { emoji: "📸", title: "Post something authentic on social media" },
      { emoji: "👋", title: "Reconnect with an old friend" },
    ],
  },
  {
    id: "creative",
    label: "Creative",
    emoji: "🎨",
    templates: [
      { emoji: "🎨", title: "Draw or sketch something for 15 min" },
      { emoji: "🎵", title: "Learn a new song or instrument piece" },
      { emoji: "📷", title: "Take 5 creative photos today" },
      { emoji: "🍳", title: "Cook a dish you've never made before" },
      { emoji: "✏️", title: "Write a short poem or story" },
      { emoji: "🎬", title: "Create a 30-second video/reel" },
      { emoji: "🧩", title: "Solve a puzzle or brain teaser" },
    ],
  },
];
