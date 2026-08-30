/** The document a new study starts from. Small and valid, so Validate passes at once. */
export function makeTemplate(): string {
  return JSON.stringify(
    {
      id: "my-study",
      version: 1,
      name: "Soundings",
      title: "My study",
      theme: {
        accent: { light: "#1f4e79", dark: "#c8a55b" },
        onAccent: { light: "#f8f9f9", dark: "#0e1316" },
      },
      segments: [{ id: "everyone", label: "Qualified respondent", transcriptLabel: "Respondent" }],
      outcomePrecedence: ["everyone"],
      screening: [
        {
          id: "consent",
          type: "single",
          prompt: "Are you willing to take a short voice interview?",
          options: [
            { id: "yes", label: "Yes", effect: { kind: "qualify", outcome: "everyone" } },
            { id: "no", label: "No", effect: { kind: "terminate" } },
          ],
        },
      ],
      interview: [
        {
          id: "q1",
          audience: "all",
          required: false,
          topic: "getting started",
          text: "Thank you for taking part. I have a few questions for you. Are you ready to begin?",
        },
        { id: "q2", audience: "all", required: true, topic: "your experience", text: "Tell me about your experience." },
      ],
    },
    null,
    2,
  );
}
