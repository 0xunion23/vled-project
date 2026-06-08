export async function getSuggestions(req, res) {
  try {
    const query = req.query.q?.trim().toLowerCase();

    if (!query || query.length < 2) {
      return res.json([]);
    }

    const INTERNSHIP_SUGGESTIONS = [
      'Who can sign the NOC?',
      'How do I submit the NOC?',
      'When should I submit the NOC?',
      'Who is authorized to sign the NOC?',
      'Where can I download the NOC form?',
      'What is the NOC submission process?',

      'Is there a stipend?',
      'Do interns receive a stipend?',
      'Are there any internship rewards?',
      'What benefits do interns receive?',

      'How long is the internship?',
      'What is the internship duration?',
      'When does the internship end?',
      'Can I leave the internship early?',

      'How do I log in to ViBe?',
      'How do I update my profile in ViBe?',
      'Why am I unable to access ViBe?',
      'What should I do if ViBe is not working?',

      'What is Yaksha?',
      'How do I ask Yaksha a question?',
      'How do I contact support?',
      'Where can I get internship help?',

      'How do I form a team?',
      'How do I join a project team?',
      'Can I change my project team?',
      'Can I work on multiple projects?',
      'How do I communicate with my project team?',

      'Who is my mentor?',
      'How can I contact my mentor?',
      'Can I switch mentors?',
      'How do I attend mentor meetings?',

      'What are Spurti Points?',
      'How are Spurti Points calculated?',
      'How do I earn more Spurti Points?',
      'Why are my Spurti Points negative?',
      'Do Spurti Points affect my internship status?',
      'What perks are available through Spurti Points?',
      'Where can I view my earned Spurti Points?',

      'How is attendance tracked?',
      'What is the attendance requirement?',
      'How much Zoom attendance is required?',
      'Why is my attendance not showing?',
      'How do I update my Zoom email?',
      'Which email should I use for Zoom?',
      'What happens if my attendance falls below 85%?',
      'What happens if I miss live sessions?',

      'How are poll responses tracked?',
      'What happens if I miss a poll?',
      'Are polls mandatory?',
      'How are quizzes conducted?',
      'What quiz score is required?',
      'What happens if I fail a quiz?',

      'What happens if I am moved to a later batch?',
      'Can I rejoin the internship later?',
      'What happens if I miss a submission?',

      'How do I upload my daily work?',
      'How do I submit my daily report?',
      'How do I upload project documents?',
      'How do I submit weekly reports?',
      'How do I submit project documentation?',
      'How do I submit my Rosetta journal?',
      'How do I upload my final report?',

      'What is the Bronze Phase?',
      'How do I complete Bronze Phase tasks?',
      'What is the Silver Phase?',
      'How do I complete Silver Phase tasks?',
      'What is the Gold Phase?',
      'How do I complete Gold Phase tasks?',
      'What are the phase requirements?',

      'When will certificates be issued?',
      'What are the requirements for certification?',
      'How do I receive my completion certificate?',
      'Will I receive a certificate after completion?',

      'How are projects evaluated?',
      'What are the project submission requirements?',
      'How do I submit my final project?',
      'What should be included in my project documentation?',
      'What technologies can I use in my project?',

      'How do I check my progress?',
      'Where can I view my progress?',
      'Where can I access internship resources?',
      'Where can I find internship announcements?',
      'How do I participate in project discussions?'
    ];

    const matches = INTERNSHIP_SUGGESTIONS
      .filter((question) =>
        question.toLowerCase().includes(query)
      )
      .slice(0, 5);

    res.json(matches);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Failed to fetch suggestions'
    });
  }
}
