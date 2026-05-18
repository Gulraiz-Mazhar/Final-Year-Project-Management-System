export const mockData = {
  // Matches user.model.js
  currentUser: {
    _id: "u1",
    name: "John Doe",
    email: "john@fypms.edu",
    role: "Student",
    studentId: "2021-CS-101",
    batch: "2021-25"
  },
  // Matches academicSession.model.js
  session: {
    name: "Fall 2025",
    isCurrent: true,
    timeline: [
      { stage: "Proposal", startDate: "2025-09-01", deadline: "2025-10-15", isSubmissionOpen: false },
      { stage: "Development", startDate: "2025-10-16", deadline: "2025-12-01", isSubmissionOpen: true }
    ]
  },
  // Matches project.model.js
  project: {
    _id: "p1",
    title: "AI-Powered Recommendation Engine",
    category: "Machine Learning",
    year: 2025,
    visibility: "Internal",
    totalMarks: 85,
    finalGrade: "A",
    group: {
        name: "InnovateX Solutions",
        members: ["John Doe", "Jane Smith"]
    }
  },
  // Matches submission.model.js (Crucial for Plagiarism View)
  submission: {
    integrity: {
      plagiarismScore: 18,
      aiContentScore: 45,
      status: "Flagged",
      reportUrl: "#"
    },
    files: [
      { name: "FYP_Report_JohnDoe.docx", size: 4200, type: "docx" },
      { name: "Source_Code.zip", size: 15000, type: "zip" }
    ],
    evaluation: {
      supervisor: { marks: 85, remarks: "Good work on the methodology." }
    }
  },
  // Matches notification.model.js (New)
  notifications: [
    { _id: 1, title: "Proposal Approved", message: "Your project proposal has been approved.", type: "SUCCESS", createdAt: "2 hours ago" },
    { _id: 2, title: "Deadline Approaching", message: "Final Report due in 24 hours.", type: "WARNING", createdAt: "5 hours ago" }
  ],
  // Matches announcement.model.js (New)
  announcements: [
    { _id: 1, title: "Final Demo Schedule", body: "The schedule has been uploaded.", createdAt: "Oct 26, 2023" }
  ]
};