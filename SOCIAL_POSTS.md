# Social Media Launch Posts — SpeakIQ · Tutiq · ResumeVault

Generated: 2026-05-13
Status: Ready to post

---

## SPEAKIQ — speakiq.app

### Reddit Posts

#### r/languagelearning
**Title:** I built an AI conversation partner for language learners — free to try (no drills, just talking)

Most language apps make you do flashcard drills or translation exercises. That's not how humans actually become fluent — you need to *talk*.

So I built SpeakIQ: an AI that has real conversations with you in 50+ languages, corrects your grammar in context, and adapts to your level.

What makes it different:
- 7 learning modes: Conversation, Grammar Drill, Vocabulary Builder, Story Mode, Debate, Cultural Immersion, Interview Prep
- Grammar corrections happen naturally, mid-conversation — not as a separate drill
- Works for beginners through advanced learners
- Streak tracking to keep you consistent
- 20 free messages/day, no credit card

I use it daily to practice Tamil (heritage language I half-lost). Would love feedback from actual language learners.

Try it free: https://speakiq.app

What language are you currently learning? I'll test it with you in the comments 👇

---

#### r/learnspanish
**Title:** Free AI conversation partner for Spanish — no drills, just actual talking

Been learning Spanish for 2 years and the biggest gap was always practice: no native speakers nearby, iTalki getting expensive.

Built an AI that just... talks to you. In Spanish. At your level.

You tell it you're a beginner → it uses simple vocabulary, slows down, explains idioms.
Intermediate → natural conversation, corrects grammar gently, uses colloquialisms.
Advanced → debates, news discussions, regional accents.

Also has interview prep mode if you're job hunting in Spanish-speaking markets.

Free to use: https://speakiq.app (20 messages/day, no account needed)

---

#### r/artificial
**Title:** Built a free AI language tutor with 7 learning modes — curious what the AI community thinks

**The problem:** Language learning apps are mostly drill-based (Duolingo, Anki). Real fluency requires *conversation* — and most people don't have access to affordable conversation partners.

**What I built:** SpeakIQ — powered by Claude + Groq, supports 50+ languages, 7 distinct learning modes including cultural immersion and interview prep.

**Tech stack:** Next.js, Claude API (conversation + grammar), Groq (speed), Stripe for Pro tier, deployed on Vercel.

**Interesting design choice:** I use Claude for contextual grammar correction (it understands nuance) and Groq for the raw conversation speed. Fallback chain: Groq → Gemini → Claude so 90% of conversations hit free-tier APIs.

Try it: https://speakiq.app

Questions or roasts welcome — this is still early and I want to improve it.

---

### Twitter/X Thread

🧵 I built SpeakIQ — a free AI conversation partner for language learners.

Here's what I learned building it (and why I think language apps are all wrong):

1/ The problem: Duolingo, Babbel, Anki — all drill-based. You memorise words and grammar rules. But real fluency comes from conversation. You need to *produce* language under pressure, not just recognise it.

2/ The solution: An AI that just talks to you. In 50+ languages. At your exact level. With grammar corrections woven into the conversation naturally — not as separate exercises.

3/ 7 learning modes:
• 💬 Conversation — free chat
• 📝 Grammar Drill — targeted practice
• 📚 Vocabulary Builder — in context
• 📖 Story Mode — co-create a story
• 🗣 Debate — argue a position
• 🌍 Cultural Immersion — idioms + customs
• 💼 Interview Prep — for bilingual job interviews

4/ The AI fallback chain was the most interesting engineering challenge. Claude is expensive at scale. So I built: Groq (free, fast) → Gemini (free, capable) → Claude (paid, best for nuance). 90% of conversations hit the free tier.

5/ It's free to try — 20 messages/day, no credit card.
Pro is $7/mo for unlimited + grammar reports.

Link: https://speakiq.app

What language are you learning? Drop it below 👇

Powered by @AnthropicAI Claude — best LLM for language nuance I've found.

---

---

## TUTIQ — tutiq.app

### Reddit Posts

#### r/Parenting
**Title:** Built a free AI tutor for my kids — GCSE, 11+, and interview prep, no subscription needed

My kids needed extra help with GCSE maths and I couldn't justify £40/hr for a human tutor every week.

So I spent a few weeks building an AI tutor that actually adapts to their level.

What it does:
- **GCSE track** (Year 9–11): Maths, English, Science, History, Geography — aligned to AQA/Edexcel/OCR
- **11+ Prep** (Age 9–11): Verbal/Non-Verbal Reasoning, maths speed drills, comprehension
- **Interview Prep** (adults): Tech DSA, NHS, Law, general STAR method coaching

The AI explains things patiently at the learner's level. My 13-year-old used it for 30 mins on quadratic equations yesterday without me having to help once.

Free to use: https://tutiq.app (3 free sessions, then $8/mo for unlimited)

Would love feedback from parents of exam-age kids especially.

---

#### r/GCSE
**Title:** Free AI tutor for GCSE revision — explains concepts, doesn't just give answers

Built this for my own kids but figured the community might find it useful.

Tutiq is an AI tutor aligned to AQA, Edexcel, and OCR syllabi. You type a concept you're stuck on, it explains it from scratch at your level. Doesn't just give you the answer — makes you work through it.

Works for: Maths, English Lit/Lang, Combined and Triple Science, History, Geography.

Free: 3 sessions. Pro: $8/mo unlimited.

https://tutiq.app

What subject are you finding hardest right now?

---

#### r/Teachers
**Title:** Built a free AI tutoring tool — would love teacher feedback before I improve it

I'm a developer, not a teacher, so I'd genuinely love to know where this falls short.

Tutiq is an AI tutor for GCSE students (Year 9–11) with exam-board aligned content (AQA, Edexcel, OCR) across Maths, English, Science, History, Geography.

The AI tries to explain at the student's level and encourage thinking rather than just give answers. But I'm sure it's not doing this as well as a real teacher would.

Questions I'd love teacher input on:
1. Does the AI explain things in a way that builds understanding or just gives facts?
2. What subjects have the most students falling behind where AI help could fill a gap?
3. Would you recommend this to struggling students or does it feel like cheating?

Free to try: https://tutiq.app

---

### Twitter/X Thread

🧵 I built Tutiq — a free AI tutor for GCSE students, 11+ prep, and interview coaching.

Here's why I built it and what I learned:

1/ My kids needed extra help with GCSE maths. Human tutors cost £40/hr. I'm a developer. So I built one.

2/ Three learning tracks:
🎓 GCSE (Year 9–11) — AQA, Edexcel, OCR aligned
⭐ 11+ Prep (Age 9–11) — Verbal/NVR reasoning, maths drills
💼 Interview Prep (Adults) — Tech DSA, NHS, Law, STAR method

3/ The AI adapts to the learner's level automatically. Explain you're a Year 10 student → it uses GCSE vocabulary and mark scheme language. Say you're nervous about an NHS interview → it slows down and uses encouragement.

4/ It doesn't just give answers. It guides the student to *think through* the problem. This was the hardest thing to prompt engineer — getting an LLM to teach rather than solve.

5/ Free: 3 AI sessions, no account needed.
Pro: $8/mo — unlimited sessions across all tracks.

Try it: https://tutiq.app

Parents, students, teachers — feedback very welcome 👇

Powered by @AnthropicAI

---

---

## RESUMEVAULT — resumevault.app

### Reddit Posts

#### r/cscareerquestions
**Title:** Built a free ATS resume checker + AI rewrite — because I was frustrated with every paid tool

Every ATS checker I tried either:
a) Gave vague "your resume needs improvement" feedback with no specifics
b) Charged $30/month before showing you anything useful

So I built ResumeVault.

What it actually does:
- **ATS keyword analysis**: compares your resume against a job description and shows *exactly* which keywords are missing
- **AI bullet rewrites**: takes your weak bullets and rewrites them with action verbs + metrics
- **Cover letter generator**: one-click, tailored to the job description
- **Interview prep**: generates likely interview questions from your resume + the JD
- **LinkedIn import**: paste your LinkedIn URL → auto-populates fields

Free: 3 resumes/month (enough for most active job searches)
Pro: $9/mo — unlimited + full ATS engine

https://resumevault.app

Currently job hunting? Drop your biggest resume frustration below — I'll tell you if the tool solves it.

---

#### r/resumes
**Title:** Before/after: AI rewrote my resume bullets and interview callback rate improved

Before: "Responsible for managing the backend systems and database optimisation tasks"
After: "Engineered PostgreSQL query optimisations that reduced API response time by 40%, serving 2M daily active users"

The difference is measurable (action verb, metric, scale, impact). Most people know they need this but don't know how to phrase it.

Built a tool that does this automatically: https://resumevault.app

Paste your resume + a job description → it rewrites your bullets, flags missing ATS keywords, and generates a tailored cover letter.

Free to try (3 resumes/month). No credit card.

---

#### r/jobs
**Title:** Free resume tool that tells you exactly why you're not getting callbacks (ATS keyword analysis)

Most resumes get filtered out by ATS software before a human ever reads them. The filter looks for specific keywords from the job description.

Built a tool that:
1. Takes your resume + the job description you're applying for
2. Shows which keywords are present vs missing
3. Suggests exactly which phrases to add (without sounding robotic)
4. Rewrites weak bullet points with action verbs + metrics
5. Generates a tailored cover letter

Free: https://resumevault.app (3 resumes/month, no CC)

---

### Twitter/X Thread

🧵 I built ResumeVault — a free ATS resume analyser and AI rewriter.

Here's what most job seekers don't know about why they're not getting callbacks:

1/ Most companies use ATS (Applicant Tracking Systems) to filter resumes before a human ever reads them. ATS looks for specific keywords from the job posting. If your resume doesn't have them → auto-rejected.

2/ The fix sounds simple: add the right keywords. But there's a catch — stuffing keywords awkwardly makes the resume sound robotic. You need them woven in *naturally* with context.

3/ ResumeVault does this:
• Parses the job description
• Finds which keywords your resume is missing
• Rewrites bullet points to include them naturally
• Adds action verbs + metrics where missing

4/ Before: "Responsible for managing backend systems"
After: "Engineered PostgreSQL optimisations reducing API latency by 40% for 2M daily users"

The "After" passes ATS AND reads well to humans. That's the goal.

5/ Also generates tailored cover letters + likely interview questions based on your resume vs JD.

Free: 3 resumes/month, no CC.
Pro: $9/mo — unlimited.

https://resumevault.app

Currently job hunting? Reply with your target role and I'll test it for you.

---

## POSTING SCHEDULE

### Week 1 (Now)
| Day | Platform | Post |
|-----|----------|------|
| Mon | Reddit r/languagelearning | SpeakIQ main post |
| Mon | Twitter/X | SpeakIQ thread |
| Tue | Reddit r/Parenting | Tutiq main post |
| Tue | Twitter/X | Tutiq thread |
| Wed | Reddit r/cscareerquestions | ResumeVault main post |
| Wed | Twitter/X | ResumeVault thread |
| Thu | Reddit r/learnspanish | SpeakIQ niche post |
| Thu | Reddit r/GCSE | Tutiq niche post |
| Fri | Reddit r/resumes + r/jobs | ResumeVault niche posts |

### Week 2
- Reply to every comment within 24h
- Share top comment threads back on Twitter/X
- Reddit r/artificial — all 3 products (tech-angle posts)
- r/Teachers — Tutiq teacher feedback post

## RULES
- Respond to EVERY comment within 24h — this multiplies reach
- Don't cross-post same content to multiple subreddits same day
- Lead with value (story/problem) not "I built X, check it out"
- Tag @AnthropicAI on Twitter — Claude-powered posts sometimes get boosted
