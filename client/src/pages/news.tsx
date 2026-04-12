import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, ExternalLink, Brain, Shield, DollarSign, Users,
  TrendingUp, BookOpen, AlertTriangle, Zap, CheckCircle, Building2,
  GraduationCap, BarChart3,
} from "lucide-react";
import logoSrc from "@assets/a2a-blue-logo.svg";

// ─── Article Data ───
interface Article {
  category: string;
  title: string;
  author: string;
  source: string;
  url: string;
  date: string;
  summary: string;
  keyQuote: string;
  relevanceToA2A: string;
}

const ARTICLES: Article[] = [
  {
    category: "ai-transformation",
    title: "OpenAI's new reasoning AI models hallucinate more",
    author: "Kyle Wiggers",
    source: "TechCrunch",
    url: "https://techcrunch.com/2025/04/18/openais-new-reasoning-ai-models-hallucinate-more/",
    date: "2025-04-18",
    summary: "OpenAI's latest reasoning models o3 and o4-mini hallucinate at significantly higher rates than their predecessors — o3 scored a 33% hallucination rate on OpenAI's PersonQA benchmark, double that of earlier models, while o4-mini hit 48%. OpenAI acknowledges the problem but admits it doesn't fully understand why scaling reasoning models worsens hallucinations. The finding creates a serious challenge for enterprise deployments where accuracy is paramount.",
    keyQuote: "A law firm likely wouldn't be pleased with a model that inserts lots of factual errors into client contracts.",
    relevanceToA2A: "Directly validates A2A Global's core premise: AI hallucinations are a persistent, worsening problem that creates demand for human expert verification across high-stakes industries.",
  },
  {
    category: "ai-transformation",
    title: "As more Americans adopt AI tools, fewer say they can trust the results",
    author: "Devin Coldewey",
    source: "TechCrunch",
    url: "https://techcrunch.com/2026/03/30/ai-trust-adoption-poll-more-americans-adopt-tools-fewer-say-they-can-trust-the-results/",
    date: "2026-03-30",
    summary: "A Quinnipiac University poll of nearly 1,400 Americans found that 76% say they trust AI rarely or only sometimes, while only 21% trust it most or almost all of the time — even as AI adoption rises. The data reveals a striking contradiction: 51% use AI for research but only 21% trust AI-generated information, with 55% believing AI will do more harm than good.",
    keyQuote: "The contradiction between use and trust of AI is striking. Americans are clearly adopting AI, but they are doing so with deep hesitation, not deep trust.",
    relevanceToA2A: "Confirms the trust gap that A2A Global's verification platform directly addresses — users need AI's speed but crave human-verified accuracy for consequential decisions.",
  },
  {
    category: "ai-transformation",
    title: "The Rise of Rogue AI (Shadow AI and the $670K Data Breach Premium)",
    author: "Wired Brand Lab / IBM",
    source: "Wired",
    url: "https://www.wired.com/sponsored/story/the-rise-of-rogue-ai/",
    date: "2025-11-04",
    summary: "IBM's 2025 Cost of a Data Breach report found that security incidents involving shadow AI accounted for 20% of all breaches — adding an average of $670,000 to breach costs. Only 41% of businesses have implemented approved AI internally, yet over 75% of employees are using generative AI without CISO sign-off, creating a massive governance gap.",
    keyQuote: "Model drift skews the analysis in his executive brief; nevertheless, that brief could still have repercussions on business decisions due to inaccurate information influencing the decision-making process.",
    relevanceToA2A: "Illustrates the enterprise risk of unverified AI output — A2A's expert-in-the-loop model provides the oversight layer missing from most enterprise AI deployments.",
  },
  {
    category: "ai-transformation",
    title: "Trust issues: Why authority beats speed in the age of AI",
    author: "FT Professional Research",
    source: "Financial Times",
    url: "https://info.professional.ft.com/rs/235-OIJ-339/images/FT%20Professional_Trust%20Issues%20Report.pdf",
    date: "2025-01-01",
    summary: "A survey of nearly 200 Financial Times subscribers found that in critical areas like institutional knowledge of a business or sector, human experts were preferred over AI by a 64:36 margin. Crucially, 77% of businesses say institutional knowledge of their sector is more valuable in the age of AI. A KPMG survey cited in the report found 66% of people rely on AI output without evaluating its accuracy.",
    keyQuote: "77% of businesses say that the need for institutional knowledge of their business or sector is more valuable in the age of AI. Trust now beats speed for market intelligence.",
    relevanceToA2A: "Strongly supports A2A's positioning: expert domain knowledge and human judgment remain premium assets; the market is demanding verification, not just AI speed.",
  },
  {
    category: "ai-transformation",
    title: "The Math on AI Agents Doesn't Add Up",
    author: "Steven Levy",
    source: "Wired",
    url: "https://www.wired.com/story/ai-agents-math-doesnt-add-up/",
    date: "2026-01-23",
    summary: "A research paper argues AI agents are mathematically constrained to fail at scale, as error rates compound across multi-step tasks. Industry leaders push back but acknowledge that hallucinations are substantial enough to block widespread enterprise agent deployment — 'the promised value has not been realized.' Human verification remains permanently necessary.",
    keyQuote: "Managing hallucinations can disrupt entire workflows, undermining much of an agent's value. The promised value has not been realized.",
    relevanceToA2A: "Validates the case for human verification marketplaces: even as AI agents scale, human oversight remains mathematically necessary, creating a durable market for expert verification.",
  },
  {
    category: "ai-transformation",
    title: "Bridging the Trust Gap: FT x IPA Global Trust Study",
    author: "Financial Times / IPA",
    source: "Financial Times",
    url: "https://commercial.ft.com/news-insights/ft-ipa-new-research/",
    date: "2025-07-09",
    summary: "A global study of over 750 B2B decision-makers found that only 9% trust generative AI, 69% disagreed that trusting technology is the same as trusting a human, and only 22% of companies treat trust as a board-level KPI — despite evidence that doing so makes companies 3x more likely to report stronger profits.",
    keyQuote: "Only 9% trust generative AI. 69% of business decision-makers disagreed with the statement that 'Trusting a piece of technology is the same as trusting a human.'",
    relevanceToA2A: "Directly quantifies the scale of the trust gap A2A addresses — the sectors with the deepest trust deficit (finance, tech) are A2A's primary target markets.",
  },
  {
    category: "human-ai-collaboration",
    title: "How AI labs use Mercor to get the data companies won't share",
    author: "Dominic-Madori Davis",
    source: "TechCrunch",
    url: "https://techcrunch.com/2025/10/29/how-ai-labs-use-mercor-to-get-the-data-companies-wont-share/",
    date: "2025-10-29",
    summary: "Mercor, valued at $10 billion and generating $500M ARR, pays former investment bankers, lawyers, and consultants up to $200/hour to fill out forms and evaluate AI outputs — disbursing over $1.5 million daily to 30,000+ contractors. CEO Brendan Foody describes it as creating a new gig economy for knowledge workers, analogous to what Uber did for transportation.",
    keyQuote: "Over time, ChatGPT will be better than the best consulting firm, better than the best investment bank, and better than the best law firm. That's going to transform the economy radically.",
    relevanceToA2A: "Proof-of-concept that a $10B market exists for connecting expert human knowledge with AI systems — A2A Global targets the complementary opportunity: human experts verifying AI output for end users.",
  },
  {
    category: "human-ai-collaboration",
    title: "Uber, OpenAI, Mercor, Amazon workers train AI to stand in for humans",
    author: "Megan Morrone",
    source: "Axios",
    url: "https://www.axios.com/2025/11/04/ai-job-uber-amazon-openai-mercor",
    date: "2025-11-04",
    summary: "A comprehensive look at the growing ecosystem of human experts monetizing their knowledge by training AI models — from Mercor paying doctors and lawyers up to $200/hour, to OpenAI working with Juilliard students and ex-investment bankers. These 'AI trainers' are the invisible layer keeping generative AI functional.",
    keyQuote: "AI continues to improve. We are pushed to enhance our skills. Some of us rise to the challenge. Many of us do not.",
    relevanceToA2A: "Maps the structural shift in expert labor toward AI-related knowledge work, validating A2A's expert-economy thesis and the monetization opportunity for professionals with domain expertise.",
  },
  {
    category: "human-ai-collaboration",
    title: "Humans provide necessary 'checks and balances' for AI, says Lattice CEO",
    author: "Julie Bort",
    source: "TechCrunch",
    url: "https://techcrunch.com/2025/06/06/humans-provide-neccessary-checks-and-balance-for-ai-says-lattice-ceo/",
    date: "2025-06-06",
    summary: "Lattice CEO Sarah Franklin argues that human oversight of AI is not optional but structurally necessary for enterprise accountability — leaders must be transparent about what AI is doing, apply it narrowly to specific goals, and ensure humans remain ultimately accountable.",
    keyQuote: "We put people first. Human connection cannot be replaced, and the winners are going to be the companies that understand that. Otherwise, we are in service of the AI versus the AI being in service of us.",
    relevanceToA2A: "Enterprise endorsement of the human-oversight thesis from a $3B SaaS company: structured human accountability around AI is a competitive advantage, not a cost center.",
  },
  {
    category: "human-ai-collaboration",
    title: "Anthropic's AI is writing its own blog — with human oversight",
    author: "Maxwell Zeff",
    source: "TechCrunch",
    url: "https://techcrunch.com/2025/06/03/anthropics-ai-is-writing-its-own-blog-with-human-oversight/",
    date: "2025-06-03",
    summary: "Anthropic's Claude Explains blog shows the practical model of human-AI collaboration: AI generates drafts while subject matter experts enhance them with insights, practical examples, and contextual knowledge. The article notes that AI-only content has repeatedly failed — Bloomberg corrected dozens of AI summaries, G/O Media's AI articles attracted widespread ridicule.",
    keyQuote: "Claude Explains is an early example of how teams can use AI to augment their work... Rather than replacing human expertise, we're showing how AI can amplify what subject matter experts can accomplish.",
    relevanceToA2A: "Major AI lab publicly validates the human-expert-in-the-loop model as the correct architecture, directly reinforcing A2A's verification layer thesis.",
  },
  {
    category: "human-ai-collaboration",
    title: "Hundreds of Google AI Workers Were Fired Amid Fight Over Working Conditions",
    author: "Kate Knibbs",
    source: "Wired",
    url: "https://www.wired.com/story/hundreds-of-google-ai-workers-were-fired-amid-fight-over-working-conditions/",
    date: "2025-09-15",
    summary: "Over 200 contractors at GlobalLogic — 'super raters' with master's or PhD degrees — who were hired to evaluate and improve Google's Gemini and AI Overviews were laid off. The contractors, paid $28-32/hour for specialized evaluation tasks, represent the hidden labor behind AI's apparent competence.",
    keyQuote: "As raters, we play an incredibly crucial role because engineers, amid coding and other tasks, lack the time to fine-tune and obtain the necessary feedback for the bot. We function like lifeguards on the beach — we're there to ensure nothing goes awry.",
    relevanceToA2A: "Illustrates both the critical role of human expert evaluators in AI quality and the market opportunity to formalize and scale this service through a platform like A2A Global.",
  },
  {
    category: "human-ai-collaboration",
    title: "2025 was the year AI got a vibe check",
    author: "Kirsten Korosec",
    source: "TechCrunch",
    url: "https://techcrunch.com/2025/12/29/2025-was-the-year-ai-got-a-vibe-check/",
    date: "2025-12-29",
    summary: "TechCrunch's year-in-review finds 2025 was defined by the collision between AI's trillion-dollar ambitions and harder realities: more than 50 copyright lawsuits, reports of AI psychosis linked to multiple model releases, and a growing enterprise backlash against AI hype.",
    keyQuote: "If 2025 was the year AI started to grow up and face hard questions, 2026 will be the year it has to answer them. The hype cycle is starting to fizzle into something more like accountability.",
    relevanceToA2A: "The 'vibe check' moment creates the commercial inflection point A2A needs — enterprises moving from hype to accountability will invest in verification infrastructure.",
  },
  {
    category: "remote-work-ai-earnings",
    title: "In 2026, AI will move from hype to pragmatism",
    author: "Devin Coldewey",
    source: "TechCrunch",
    url: "https://techcrunch.com/2026/01/02/in-2026-ai-will-move-from-hype-to-pragmatism/",
    date: "2026-01-02",
    summary: "TechCrunch's expert panel predicts that 2026 marks the shift from AI hype to practical augmentation — with 'the year of the humans' emerging as AI fails to deliver autonomous workflows. Fine-tuned small language models (SLMs) are displacing general LLMs for enterprise use.",
    keyQuote: "2026 will be the year of the humans. AI has not worked as autonomously as we thought, and the conversation will focus more on how AI is being used to augment human workflows, rather than replace them.",
    relevanceToA2A: "Industry consensus that the 'year of humans' creates a structural opening for platforms enabling expert humans to augment AI — precisely A2A's model.",
  },
  {
    category: "remote-work-ai-earnings",
    title: "VCs predict strong enterprise AI adoption next year — again",
    author: "Connie Loizos",
    source: "TechCrunch",
    url: "https://techcrunch.com/2025/12/29/vcs-predict-strong-enterprise-ai-adoption-next-year-again/",
    date: "2025-12-29",
    summary: "A survey of 24 enterprise-focused VCs revealed that 95% of enterprises are not yet getting meaningful ROI on AI investments per an MIT study. VCs highlight the need for 'proprietary or continuously improving data' and 'deep industry knowledge' as key moats.",
    keyQuote: "The strongest moat comes from how effectively they transform an enterprise's existing data into better decisions. Enterprises already sit on incredibly rich data; what they lack is the ability to reason over it in a targeted, trustworthy way.",
    relevanceToA2A: "VC intelligence confirming that trust and proprietary expert knowledge are the key value drivers in enterprise AI — aligning perfectly with A2A's expert-verified intelligence positioning.",
  },
  {
    category: "remote-work-ai-earnings",
    title: "Successful AI adoption needs workers in the loop",
    author: "Financial Times Staff",
    source: "Financial Times",
    url: "https://www.ft.com/content/d42fa720-1585-4a7e-830b-b17ee2ca0d6d",
    date: "2025-10-22",
    summary: "An FT analysis reveals that while 80% of businesses have dabbled with enterprise AI, only 40% have actually deployed it — and a Gallup poll from June 2025 showed that workers embedded in AI workflows are central to bridging this gap.",
    keyQuote: "While 80% of businesses have dabbled with enterprise AI solutions, only 40% have deployed them. Success hinges on workers being actively involved.",
    relevanceToA2A: "Data point on the massive deployment gap — human-in-the-loop services like A2A Global directly address the 40-percentage-point shortfall between AI experimentation and actual deployment.",
  },
  {
    category: "student-reskilling",
    title: "AI Pushing Students to Consider Changing Majors",
    author: "Ryan Quinn",
    source: "Inside Higher Ed",
    url: "https://www.insidehighered.com/news/quick-takes/2026/04/02/ai-pushing-students-consider-changing-majors-data-shows",
    date: "2026-04-02",
    summary: "A Gallup/Lumina Foundation survey of 3,801 students found that 47% have considered changing their major due to AI's impact on the job market, and 16% have already done so. Between 2022 and 2025, early-career workers in AI-exposed occupations experienced a 16% relative employment decline.",
    keyQuote: "47% of students have thought about switching their major either 'a great deal' or 'a fair amount' amid the rise of AI. Between 2022 and 2025, early-career workers in AI-exposed occupations experienced 16% relative employment declines.",
    relevanceToA2A: "Validates the student reskilling market — young professionals need platforms that help them pivot toward AI-augmented career paths where human judgment is valued.",
  },
  {
    category: "student-reskilling",
    title: "How AI is Reshaping College Enrollment Strategy in 2026",
    author: "Cengage Group Research",
    source: "Cengage Group",
    url: "https://www.cengagegroup.com/news/perspectives/2026/how-technology-ai-and-career-readiness-are-reshaping-enrollment-strategy/",
    date: "2026-02-24",
    summary: "Cengage's 2025 Graduate Employability Report found that only 51% of graduates believe they had sufficient AI skills for the jobs they applied to, and only 30% of 2025 graduates secured full-time work in their field. Colleges are scrambling to embed AI fluency into all curricula.",
    keyQuote: "Only 30% of 2025 graduates have secured full-time work in their field and nearly half feel unprepared to apply for entry-level roles.",
    relevanceToA2A: "Quantifies the scale of the student preparedness crisis — A2A can provide students with real-world AI verification work that builds both income and the hybrid human-AI skills employers now demand.",
  },
  {
    category: "student-reskilling",
    title: "How AI Impacts Students Entering the Job Market",
    author: "St. John's University Editorial Team",
    source: "St. John's University",
    url: "https://www.stjohns.edu/news-media/johnnies-blog/ai-impact-students-entering-job-market",
    date: "2025-12-08",
    summary: "A Harvard study tracking 62 million workers across 285,000 US firms found that junior positions are shrinking at companies integrating AI since 2023, as AI erodes 'the bottom rungs of career ladders.' A Stanford analysis found workers aged 22–25 in AI-exposed fields experienced a 13% relative employment decline.",
    keyQuote: "The real challenge isn't just that AI is changing work, it's that we're deploying it faster than we can understand its implications. Students entering this market aren't just facing a skills gap; they're entering an environment of profound institutional uncertainty.",
    relevanceToA2A: "Harvard and Stanford data underscore the urgency of the career reskilling opportunity A2A addresses — displaced entry-level workers need platforms to monetize their expertise while building AI-era skills.",
  },
  {
    category: "student-reskilling",
    title: "How Universities Can Prepare Students for AI-First Workplaces",
    author: "BCG Research Team",
    source: "BCG Global",
    url: "https://www.bcg.com/publications/2026/preparing-students-ai-first-workplaces",
    date: "2026-02-04",
    summary: "BCG's analysis finds that universities must systematically embed AI fluency across all subjects and shift careers services from post-graduation advice to experiential learning throughout a student's degree. Ohio State's AI Fluency initiative and Purdue's data-industry pairing scheme are cited as leading models.",
    keyQuote: "It's critical for universities to rethink how they are preparing their students for careers from their first day at university. That means a systematic approach to embedding AI skills across all subjects.",
    relevanceToA2A: "Establishes universities as key institutional partners for A2A's student-engagement strategy — embedding A2A's expert verification platform into university AI curricula as experiential learning.",
  },
  {
    category: "sme-enterprise-ai-risk",
    title: "Major Insurers Want Out of AI Coverage as 'Black Box' Risk Grows",
    author: "TechBuzz AI Staff",
    source: "TechBuzz AI",
    url: "https://www.techbuzz.ai/articles/major-insurers-want-out-of-ai-coverage-as-black-box-risk-grows",
    date: "2025-11-23",
    summary: "AIG, Great American, and WR Berkley are petitioning regulators to exclude AI liability from corporate policies, citing systemic risk. Real-world examples include Google's AI Overview triggering a $110M lawsuit, Air Canada being forced to honor fabricated chatbot discounts, and a $25M deepfake fraud at Arup.",
    keyQuote: "We can handle a $400 million loss to one company. What we can't handle is an agentic AI mishap that triggers 10,000 losses at once.",
    relevanceToA2A: "Insurance industry pullback from AI liability directly forces enterprises to adopt pre-deployment verification and human oversight — creating demand for A2A's expert validation services.",
  },
  {
    category: "sme-enterprise-ai-risk",
    title: "Insurers launch cover for losses caused by AI chatbot errors",
    author: "Financial Times Staff",
    source: "Financial Times",
    url: "https://www.ft.com/content/1d35759f-f2a9-46c4-904b-4a78ccc027df",
    date: "2025-05-01",
    summary: "Lloyd's of London insurers, through startup Armilla (backed by Y Combinator), have launched policies covering losses from AI chatbot errors — but coverage only triggers if the AI's performance fell short of initial expectations or standards. Standard general policies typically have AI sub-limits as low as $25,000 within $5M general coverage.",
    keyQuote: "Across the commercial insurance industry, new policies say they won't cover losses caused by chatbots.",
    relevanceToA2A: "Creates an insurance-driven commercial case for AI performance standards and pre-deployment human validation — A2A's expert layer reduces enterprise insurance risk exposure.",
  },
  {
    category: "sme-enterprise-ai-risk",
    title: "Cognizant Research Shows Plug-and-Play AI is a Myth",
    author: "Cognizant Research Team",
    source: "Financial Times / PR Newswire",
    url: "https://markets.ft.com/data/announce/detail?dockey=600-202603101205PR_NEWS_EURO_ND__EN06751-1",
    date: "2026-03-10",
    summary: "Cognizant's global enterprise research found that 63% of enterprises report moderate-to-large gaps between their AI ambitions and current capabilities. The top barriers to scaling AI are: regulatory and compliance concerns (33%), inability to demonstrate ROI (31%), and talent shortages (27%).",
    keyQuote: "A lot of vendors come in thinking that the off-the-shelf solutions they have would fit our needs, but often enough they find that that's not the case. Generic, off-the-shelf AI solutions are a leading reason to reject an AI provider.",
    relevanceToA2A: "Confirms the enterprise demand for expert-tailored, validated AI solutions over generic off-the-shelf tools — positioning A2A's expert verification layer as a key differentiator.",
  },
  {
    category: "sme-enterprise-ai-risk",
    title: "ChatGPT hit with privacy complaint over defamatory hallucinations",
    author: "Natasha Lomas",
    source: "TechCrunch",
    url: "https://techcrunch.com/2025/03/19/chatgpt-hit-with-privacy-complaint-over-defamatory-hallucinations/",
    date: "2025-03-19",
    summary: "A Norwegian citizen found ChatGPT falsely claiming he had been convicted for murdering two of his children — prompting a GDPR complaint with potential penalties of up to 4% of OpenAI's global annual turnover. The case follows Italy's €15M fine against OpenAI and highlights the growing regulatory risk of AI hallucinations.",
    keyQuote: "If hallucinations are not stopped, people can easily suffer reputational damage. AI companies should stop acting as if the GDPR does not apply to them.",
    relevanceToA2A: "Legal precedents for AI hallucination liability create regulatory demand for fact-checking and verification services — A2A's expert layer reduces organizations' GDPR/liability exposure.",
  },
  {
    category: "sme-enterprise-ai-risk",
    title: "AI sycophancy isn't just a quirk, experts consider it a 'dark pattern'",
    author: "Alyse Stanley",
    source: "TechCrunch",
    url: "https://techcrunch.com/2025/08/25/ai-sycophancy-isnt-just-a-quirk-experts-consider-it-a-dark-pattern-to-turn-users-into-profit/",
    date: "2025-08-25",
    summary: "TechCrunch's investigation reveals that AI chatbot 'sycophancy' — models trained to affirm and validate user inputs rather than challenge them — is a structural design flaw contributing to reinforced misconceptions and decision-making errors. Experts label it a 'dark pattern' that prioritizes engagement over accuracy.",
    keyQuote: "Psychosis thrives at the boundary where reality stops pushing back. AI is designed to give you what you want, not what is true — and that is now classified as a dark pattern.",
    relevanceToA2A: "Sycophancy as a structural AI design flaw means AI outputs systematically reinforce user biases — making independent human expert review essential for any consequential decision.",
  },
  {
    category: "university-research",
    title: "New sources of inaccuracy? A conceptual framework for studying AI hallucinations",
    author: "Anqi Shao",
    source: "Harvard Kennedy School",
    url: "https://misinforeview.hks.harvard.edu/wp-content/uploads/2025/08/shao_new_inaccuracy_sources_20250827.pdf",
    date: "2025-08-27",
    summary: "Published in the Harvard Kennedy School Misinformation Review, this framework establishes AI hallucinations as a structurally distinct form of misinformation. The paper's 'Swiss cheese model' identifies three compounding vulnerability layers: training data limitations, opaque training processes, and weak output gatekeeping.",
    keyQuote: "AI hallucinations result from multi-layered technical vulnerabilities different from how human misinformation emerges. As long as the core next-token prediction mechanism remains, hallucinations persist as an ongoing technical challenge.",
    relevanceToA2A: "Academic framework from Harvard confirming hallucinations are structurally permanent in current AI architectures — providing rigorous scholarly foundation for A2A's human expert verification model.",
  },
  {
    category: "university-research",
    title: "AI and Human Oversight: A Risk-Based Framework for Alignment",
    author: "Branislav Rankov",
    source: "arXiv / Cornell University",
    url: "https://arxiv.org/abs/2510.09090",
    date: "2025-10-10",
    summary: "This paper proposes a structured risk-based framework mapping three human oversight models (Human-in-Command, Human-in-the-Loop, Human-on-the-Loop) to AI deployment contexts by risk level. It argues that Human-in-the-Loop is critical for high/medium-risk contexts such as clinical decision support, financial analysis, and legal review.",
    keyQuote: "Rather than focusing on how AI could or will replace humans, it is more appropriate to emphasize the degree of human oversight required. Responsible AI deployment demands context-sensitive oversight aligned with the level of risk posed by the system's decisions.",
    relevanceToA2A: "Academic formalization of the human oversight models A2A implements — provides research credibility for A2A's verification framework and supports positioning as a compliance tool.",
  },
  {
    category: "university-research",
    title: "Carnegie Mellon at NeurIPS 2025: Multi-Agent Debate and LLM Reliability Research",
    author: "Carnegie Mellon University ML Blog",
    source: "Carnegie Mellon University",
    url: "https://blog.ml.cmu.edu/2026/02/11/carnegie-mellon-at-neurips-2025/",
    date: "2026-02-11",
    summary: "CMU researchers presented 156 papers at NeurIPS 2025, including findings on Multi-Agent Debate (MAD) showing that most performance gains in LLM ensembles come from majority voting rather than inter-agent debate. AI systems produce homogenized errors that simple AI-on-AI checking cannot catch.",
    keyQuote: "Most gains in Multi-Agent Debate come from majority voting rather than debate itself. Experiments show that debate alone doesn't improve expected correctness — and AI models share the same blindspots.",
    relevanceToA2A: "CMU research confirms that current AI architectures produce systemic, homogenized errors that simple AI-on-AI checking cannot catch — validating the need for genuinely independent human expert review.",
  },
  {
    category: "university-research",
    title: "MIT students' works redefine human-AI collaboration at NeurIPS",
    author: "MIT News Staff",
    source: "MIT News",
    url: "https://news.mit.edu/2025/mit-students-works-redefine-human-ai-collaboration-0129",
    date: "2025-01-29",
    summary: "MIT course projects presented at NeurIPS 2024 demonstrate innovative human-AI collaboration frameworks — including an educational fact-checking game that trains critical thinking through AI-generated content and a human-AI collaborative drawing tool that reduces cognitive load while preserving creative agency.",
    keyQuote: "These projects illustrate a broader vision for artificial intelligence: one that goes beyond automation to catalyze creativity, reshape education, and strengthen human agency.",
    relevanceToA2A: "MIT's leading research framing positions human judgment and verification as the apex skill in AI-augmented systems — supporting A2A's model of expert human review as a premium service.",
  },
  {
    category: "university-research",
    title: "NeurIPS 2025 Papers Contain Over 50 AI Hallucinations in Published Research",
    author: "Alex Cui / GPTZero Research",
    source: "Fortune / GPTZero",
    url: "https://www.linkedin.com/posts/fortune_neurips-papers-contained-100-ai-hallucinated-activity-7419772443499757568-g1pa",
    date: "2026-01-21",
    summary: "GPTZero analyzed 4,000+ research papers accepted at NeurIPS 2025 and found hallucinated citations in at least 53 papers — from researchers at Google DeepMind, Meta, and Microsoft. Even top AI labs cannot consistently detect AI hallucinations in their own domain.",
    keyQuote: "Over 50 papers published at NeurIPS 2025 have AI hallucinations. I don't think people realize how bad the slop is right now. Researchers from Google DeepMind and Meta published papers with fake references.",
    relevanceToA2A: "If the world's top AI researchers can't detect AI hallucinations in their own domain, non-specialist professionals have no chance without expert verification services.",
  },
  {
    category: "university-research",
    title: "UC Berkeley Experts: 11 Things AI Experts Are Watching for in 2026",
    author: "UC Berkeley News",
    source: "UC Berkeley",
    url: "https://vcresearch.berkeley.edu/news/11-things-uc-berkeley-ai-experts-are-watching-2026",
    date: "2026-01-13",
    summary: "Eleven UC Berkeley AI faculty identify key 2026 concerns, led by accelerating erosion of trust from AI-generated deepfakes and the growing asymmetry between the ease of creating fakes and the enormous effort required to verify content. Trust verification is identified as a key emerging market.",
    keyQuote: "I will be watching the accelerating erosion of trust driven by increasingly convincing AI-generated media. It takes little effort to create a fake, but enormous effort to prove it's a fake.",
    relevanceToA2A: "Berkeley's trust-erosion forecast creates a structural, multi-year market for verification services — the asymmetry between fake generation and fact-checking is A2A's core value proposition.",
  },
  {
    category: "university-research",
    title: "2025 IIF-EY Annual Survey Report on AI Use in Financial Services",
    author: "Institute of International Finance / EY",
    source: "IIF / EY",
    url: "https://www.iif.com/Publications/ID/6322/2025-IIF-EY-Annual-Survey-Report-on-AI-Use-in-Financial-Services",
    date: "2025-10-16",
    summary: "The seventh annual IIF-EY survey of financial services firms identifies four key themes in 2025: increasing AI investment, quickening adoption curves for generative AI, ongoing concerns about data quality, and an emerging governance gap between ambition and implementation.",
    keyQuote: "Two consistent themes across the years have been financial service firms' strong governance and oversight of AI and the steadily increasing investment in AI talent and capabilities.",
    relevanceToA2A: "Financial services — A2A's primary market — is the most AI-invested and governance-conscious sector, creating a premium market for credible expert verification and oversight services.",
  },
  {
    category: "industry-reports",
    title: "McKinsey Global Survey: The State of AI 2025",
    author: "Alex Singla, Alexander Sukharevsky, Lareina Yee, Michael Chui",
    source: "McKinsey & Company",
    url: "https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai",
    date: "2025-11-05",
    summary: "McKinsey's 2025 State of AI survey of 1,491 global executives finds that 88% of organizations now use AI regularly, 79% have adopted generative AI, but only 38% have begun scaling pilots across the business. High performers are distinguished by one factor above all others: defined processes to determine how and when model outputs need human validation.",
    keyQuote: "High performers are more likely to have defined processes to determine how/when model outputs need human validation for accuracy. This is the top distinguishing factor across all respondents.",
    relevanceToA2A: "McKinsey's authoritative finding that human validation processes are the #1 differentiator for AI ROI is the most powerful endorsement possible for A2A's verification platform.",
  },
  {
    category: "industry-reports",
    title: "Deloitte: State of AI in the Enterprise 2026",
    author: "Deloitte AI Institute",
    source: "Deloitte",
    url: "https://www.deloitte.com/us/en/what-we-do/capabilities/applied-artificial-intelligence/content/state-of-ai-in-the-enterprise.html",
    date: "2025-10-01",
    summary: "Deloitte's survey of 3,235 senior leaders across 24 countries finds that worker access to AI rose 50% in 2025, yet only 42% believe their strategy is highly prepared and only 1 in 5 companies has a mature model for governance of autonomous AI agents.",
    keyQuote: "Only 1 in 5 companies has a mature model for governance of autonomous AI agents. The AI skills gap is seen as the biggest barrier to integration, and addressing it will be critical to meeting AI ambitions.",
    relevanceToA2A: "Deloitte's finding that 80% of companies lack mature AI agent governance, combined with the skills gap as the top barrier, validates A2A's market for expert human oversight at scale.",
  },
  {
    category: "industry-reports",
    title: "CB Insights State of AI 2025: Record Funding, Market Maturity, and the Rise of Agentic AI",
    author: "CB Insights Research Team",
    source: "CB Insights",
    url: "https://www.scribd.com/document/1007134859/CB-Insights-Artificial-Intelligence-Report-2025",
    date: "2026-01-01",
    summary: "CB Insights' State of AI 2025 reports record global AI funding of $225.8 billion (nearly double 2024 levels). The maturation of the AI market toward production-ready enterprise deployment is precisely the phase where verification and governance infrastructure becomes essential.",
    keyQuote: "Global AI funding reached a record $225.8B in 2025, nearly double 2024 levels. 63% of new AI unicorns in 2025 are already at a Commercial Maturity Level — the industry is entering its enterprise deployment phase.",
    relevanceToA2A: "Market maturation toward enterprise deployment is precisely the phase where verification and governance infrastructure like A2A becomes indispensable.",
  },
  {
    category: "industry-reports",
    title: "Gartner Hype Cycle for Artificial Intelligence 2025: GenAI Enters the Trough",
    author: "Haritha Khandabattu, Birgi Tamersoy",
    source: "Gartner",
    url: "https://testrigor.com/blog/gartner-hype-cycle-for-ai-2025",
    date: "2025-06-11",
    summary: "Gartner's 2025 Hype Cycle marks a watershed: Generative AI has officially entered the Trough of Disillusionment, with less than 30% of CEOs satisfied with returns on GenAI investments averaging $1.9M spend. The path out of the trough requires governance infrastructure and human oversight.",
    keyQuote: "Generative AI entering the Trough of Disillusionment is a desired course correction, not a defeat. Less than 30% of CEOs were happy with their returns — the industry must shift from 'what's possible' to 'what's reliable.'",
    relevanceToA2A: "Gartner's authoritative positioning of GenAI in the disillusionment phase confirms the inflection point where verification and governance services become essential buying priorities.",
  },
  {
    category: "industry-reports",
    title: "Stanford HAI AI Index Report 2025",
    author: "Stanford HAI AI Index Steering Committee",
    source: "Stanford University / HAI",
    url: "https://hai.stanford.edu/ai-index",
    date: "2025-04-18",
    summary: "Stanford's most comprehensive AI Index to date finds AI adoption among organizations rose to 78% in 2024 (up from 55% in 2023), while AI incidents reported globally rose 56%. AI outperforms doctors on key clinical tasks but complex reasoning remains a critical weakness.",
    keyQuote: "AI outperforms doctors on key clinical tasks — but complex reasoning remains a weakness. Models still cannot reliably solve problems for which provably correct solutions don't yet exist.",
    relevanceToA2A: "Stanford's authoritative finding that complex reasoning and planning remain AI weak spots — combined with rising AI incidents — creates the academic foundation for A2A's verification market.",
  },
  {
    category: "industry-reports",
    title: "Lenovo CIO Playbook 2026: Trust and Readiness as Top Barriers",
    author: "Lenovo Research",
    source: "Financial Times / Business Wire",
    url: "https://markets.ft.com/data/announce/detail?dockey=600-202601270900BIZWIRE_USPRX____20260127_BW255538-1",
    date: "2026-01-27",
    summary: "Lenovo's survey of global CIOs finds that while 60% of organizations are in late-stage AI adoption, only 27% have a comprehensive AI governance framework. Three in five CIOs say they are more than 12 months away from their target state.",
    keyQuote: "AI is scaling faster than ever, but CIOs are telling us the same thing: Trust and readiness remain the biggest barriers to unlocking real enterprise value from AI.",
    relevanceToA2A: "CIO-level confirmation that trust and readiness gaps are the primary AI adoption blockers — A2A's expert verification platform directly resolves both barriers at scale.",
  },
];

// ─── Source Badge Colors ───
const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  "TechCrunch": { bg: "#E8F5E9", text: "#1B5E20" },
  "Wired": { bg: "#F5F5F5", text: "#212121" },
  "Financial Times": { bg: "#FFF3E0", text: "#E65100" },
  "Axios": { bg: "#E3F2FD", text: "#0D47A1" },
  "McKinsey & Company": { bg: "#E8EAF6", text: "#1A237E" },
  "Deloitte": { bg: "#E0F7FA", text: "#006064" },
  "Gartner": { bg: "#FCE4EC", text: "#880E4F" },
  "CB Insights": { bg: "#F3E5F5", text: "#4A148C" },
  "Stanford University / HAI": { bg: "#FFF8E1", text: "#B71C1C" },
  "Harvard Kennedy School": { bg: "#FFEBEE", text: "#C62828" },
  "Carnegie Mellon University": { bg: "#FFF3E0", text: "#BF360C" },
  "MIT News": { bg: "#E8F5E9", text: "#1B5E20" },
  "UC Berkeley": { bg: "#FFF8E1", text: "#E65100" },
  "arXiv / Cornell University": { bg: "#F3E5F5", text: "#6A1B9A" },
  "BCG Global": { bg: "#E0F2F1", text: "#004D40" },
  "Inside Higher Ed": { bg: "#E8F5E9", text: "#1B5E20" },
  "Cengage Group": { bg: "#E1F5FE", text: "#01579B" },
  "St. John's University": { bg: "#FCE4EC", text: "#880E4F" },
  "Fortune / GPTZero": { bg: "#FFF9C4", text: "#F57F17" },
  "IIF / EY": { bg: "#E8EAF6", text: "#283593" },
  "TechBuzz AI": { bg: "#E3F2FD", text: "#0D47A1" },
  "Financial Times / PR Newswire": { bg: "#FFF3E0", text: "#E65100" },
  "Financial Times / Business Wire": { bg: "#FFF3E0", text: "#E65100" },
};

function getSourceStyle(source: string) {
  return SOURCE_COLORS[source] || { bg: "#F5F5F5", text: "#424242" };
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// ─── Article Card ───
function ArticleCard({ article, featured = false }: { article: Article; featured?: boolean }) {
  const sourceStyle = getSourceStyle(article.source);

  return (
    <article
      className={`bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col ${featured ? "md:col-span-2" : ""}`}
    >
      <div className="p-5 sm:p-6 flex flex-col flex-1">
        {/* Source + Date */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold tracking-wide"
            style={{ backgroundColor: sourceStyle.bg, color: sourceStyle.text }}
          >
            {article.source}
          </span>
          <time className="text-xs text-gray-400" dateTime={article.date}>
            {formatDate(article.date)}
          </time>
        </div>

        {/* Title */}
        <h3 className={`font-bold text-gray-900 mb-3 leading-snug ${featured ? "text-xl sm:text-2xl" : "text-base sm:text-lg"}`}>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#0F3DD1] transition-colors"
          >
            {article.title}
          </a>
        </h3>

        {/* Author */}
        <p className="text-xs text-gray-400 mb-3">By {article.author}</p>

        {/* Summary */}
        <p className={`text-gray-600 leading-relaxed mb-4 flex-1 ${featured ? "text-sm sm:text-base" : "text-sm"}`}>
          {article.summary}
        </p>

        {/* Key Quote */}
        <blockquote className="border-l-4 border-[#0F3DD1] bg-[#EEF2FF] rounded-r-xl px-4 py-3 mb-4">
          <p className="text-[#1E3A8A] text-sm italic leading-relaxed">
            "{article.keyQuote}"
          </p>
        </blockquote>

        {/* A2A Insight */}
        <div className="bg-gradient-to-r from-[#F0F9FF] to-[#EFF6FF] rounded-xl px-4 py-3 mb-4 border border-[#BAE6FD]">
          <div className="flex gap-2 items-start">
            <Zap className="w-3.5 h-3.5 text-[#0284C7] mt-0.5 flex-shrink-0" />
            <p className="text-[#0369A1] text-xs leading-relaxed">
              <span className="font-semibold">A2A Insight: </span>{article.relevanceToA2A}
            </p>
          </div>
        </div>

        {/* Read link */}
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[#0F3DD1] text-sm font-semibold hover:underline mt-auto"
        >
          Read Full Article
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </article>
  );
}

// ─── CTA Banner ───
function CTABanner({
  variant,
  headline,
  subtext,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
}: {
  variant: "client" | "expert" | "both";
  headline: string;
  subtext: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  const bg = variant === "expert"
    ? "from-[#0A1628] to-[#0F3DD1]"
    : variant === "client"
    ? "from-[#0C2340] to-[#1E4D87]"
    : "from-[#0A1628] to-[#0F2D5E]";

  return (
    <div className={`rounded-2xl bg-gradient-to-r ${bg} p-6 sm:p-8 my-8`}>
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-white text-lg sm:text-xl font-bold mb-2 leading-snug">"{headline}"</p>
        <p className="text-blue-200 text-sm sm:text-base mb-6 leading-relaxed">{subtext}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={primaryHref}
            onClick={(e) => { e.preventDefault(); window.location.hash = primaryHref.replace(/^#/, ""); }}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white text-[#0F3DD1] text-sm font-semibold hover:bg-blue-50 transition-colors"
          >
            {primaryLabel} <ArrowRight className="w-4 h-4" />
          </a>
          {secondaryLabel && secondaryHref && (
            <a
              href={secondaryHref}
              onClick={(e) => { e.preventDefault(); window.location.hash = secondaryHref.replace(/^#/, ""); }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              {secondaryLabel}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section Header ───
function SectionHeader({
  badge,
  h2,
  lead,
  icon: Icon,
}: {
  badge: string;
  h2: string;
  lead?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mb-8">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EEF2FF] border border-[#C7D2FE] mb-4">
        <Icon className="w-3.5 h-3.5 text-[#4338CA]" />
        <span className="text-[#4338CA] text-xs font-semibold uppercase tracking-wider">{badge}</span>
      </div>
      <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight mb-3">{h2}</h2>
      {lead && <p className="text-gray-500 text-base sm:text-lg max-w-2xl">{lead}</p>}
    </div>
  );
}

// ─── Category Tab Filter ───
const CATEGORY_TABS = [
  { id: "all", label: "All" },
  { id: "ai-transformation", label: "AI Trust" },
  { id: "human-ai-collaboration", label: "Expert Economy" },
  { id: "remote-work-ai-earnings", label: "Careers" },
  { id: "student-reskilling", label: "Students" },
  { id: "sme-enterprise-ai-risk", label: "Enterprise Risk" },
  { id: "university-research", label: "Research" },
  { id: "industry-reports", label: "Industry Reports" },
];

// ─── Sticky Sidebar CTA (desktop only) ───
function StickySidebar() {
  return (
    <aside className="hidden xl:flex flex-col gap-4 w-72 flex-shrink-0 sticky top-28 self-start">
      {/* Expert CTA */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0A1628] to-[#0F3DD1] p-5 text-white">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-4 h-4 text-green-300" />
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-200">For Experts</span>
        </div>
        <p className="font-bold text-base mb-1">Earn $50–200/review</p>
        <p className="text-blue-200 text-sm mb-4 leading-relaxed">
          Finance, business and strategy experts are earning real income reviewing AI outputs. Set your own rate. Work from anywhere.
        </p>
        <a
          href="/#/register?role=expert"
          onClick={(e) => { e.preventDefault(); window.location.hash = "/register?role=expert"; }}
          className="block w-full text-center py-2.5 rounded-full bg-white text-[#0F3DD1] text-sm font-bold hover:bg-blue-50 transition-colors"
        >
          Apply Now →
        </a>
      </div>

      {/* Client CTA */}
      <div className="rounded-2xl bg-white border border-[#C7D2FE] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-[#0F3DD1]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#4338CA]">For Businesses</span>
        </div>
        <p className="font-bold text-gray-900 text-base mb-1">Get your AI verified</p>
        <p className="text-gray-500 text-sm mb-4 leading-relaxed">
          A human expert reviews your AI-generated analysis in hours, not days.
        </p>
        <a
          href="/#/register"
          onClick={(e) => { e.preventDefault(); window.location.hash = "/register"; }}
          className="block w-full text-center py-2.5 rounded-full bg-[#0F3DD1] text-white text-sm font-bold hover:opacity-90 transition-opacity"
        >
          Start Free →
        </a>
        <p className="text-center text-xs text-gray-400 mt-2">$5 free credits — no card required</p>
      </div>

      {/* Stats */}
      <div className="rounded-2xl bg-[#F8FAFF] border border-gray-100 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Why it matters</p>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-extrabold text-[#0F3DD1]">76%</span>
            <span className="text-xs text-gray-600 leading-tight">of Americans don't fully trust AI results</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-extrabold text-[#0F3DD1]">48%</span>
            <span className="text-xs text-gray-600 leading-tight">hallucination rate on OpenAI's latest model</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-extrabold text-[#0F3DD1]">$225B</span>
            <span className="text-xs text-gray-600 leading-tight">in AI funding in 2025 — governance is next</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Scroll helper ───
function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

// ─── News Nav ───
function NewsNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState<"register" | "login" | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [mobileOpen]);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 md:px-6 lg:px-8 pt-2">
        <div className="max-w-[1800px] mx-auto">
          <div className={`w-full transition-all duration-300 rounded-full ${scrolled ? "bg-white shadow-lg" : "bg-white"}`}>
            <div className="max-w-full px-4 md:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16 md:h-20">
                {/* Logo */}
                <a href="/" className="flex items-center flex-shrink-0 gap-2">
                  <img src={logoSrc} alt="A2A Global" className="h-8 sm:h-10 md:h-12 w-auto" />
                  <span className="font-semibold text-[#0F3DD1] text-sm md:text-base hidden sm:inline">Expert Opinion</span>
                </a>

                {/* Center divider line */}
                <div className="hidden lg:block flex-1 mx-8">
                  <div className="h-[1px] bg-[#0F3DD1]/20" />
                </div>

                {/* Desktop Nav */}
                <div className="hidden md:flex items-center gap-6 lg:gap-8">
                  <a href="/" className="text-[15px] font-medium text-[#686868] hover:text-[#0F3DD1] transition-colors cursor-pointer whitespace-nowrap">
                    Home
                  </a>
                  <span className="text-[15px] font-semibold text-[#0F3DD1] whitespace-nowrap border-b-2 border-[#0F3DD1] pb-0.5">
                    News
                  </span>
                  <a
                    href="/#/register?role=client&utm_source=news&utm_medium=nav&utm_campaign=header"
                    onClick={(e) => { e.preventDefault(); window.location.hash = "/register?role=client&utm_source=news&utm_medium=nav&utm_campaign=header"; }}
                    className="text-[15px] font-medium text-[#686868] hover:text-[#0F3DD1] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Get Expert Review
                  </a>

                  {/* Register + Login buttons */}
                  <div className="flex items-center gap-2 relative min-w-[200px] justify-end" onMouseLeave={() => setHoveredBtn(null)}>
                    <Link href="/register">
                      <span
                        onMouseEnter={() => setHoveredBtn("register")}
                        className={`relative z-10 inline-flex items-center justify-center text-[15px] font-medium transition-all duration-300 ease-in-out h-11 rounded-full border border-gray-300 hover:border-[#0F3DD1] text-[#686868] hover:text-[#0F3DD1] cursor-pointer ${hoveredBtn === "login" ? "w-11 px-0" : "px-5"}`}
                      >
                        {hoveredBtn === "login" ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                        ) : (
                          <span className="flex items-center gap-2 whitespace-nowrap">
                            Sign Up
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                          </span>
                        )}
                      </span>
                    </Link>
                    <Link href="/login">
                      <span
                        onMouseEnter={() => setHoveredBtn("login")}
                        className={`relative z-10 inline-flex items-center justify-center transition-all duration-300 ease-in-out bg-[#0F3DD1] text-white h-11 rounded-full cursor-pointer ${hoveredBtn === "login" ? "px-5" : "w-11 px-0"}`}
                      >
                        {hoveredBtn === "login" ? (
                          <span className="flex items-center gap-2 whitespace-nowrap text-[15px] font-semibold">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                            Login
                          </span>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                        )}
                      </span>
                    </Link>
                  </div>
                </div>

                {/* Mobile hamburger */}
                {!mobileOpen && (
                  <button className="md:hidden p-2" onClick={() => setMobileOpen(true)} aria-label="Menu">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#686868" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Nav Overlay */}
      <div className={`md:hidden fixed inset-0 z-40 transition-all duration-500 ease-in-out ${mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        <div
          className={`absolute inset-0 transition-all duration-500 ${mobileOpen ? "backdrop-blur-xl" : "backdrop-blur-none"}`}
          style={{ background: mobileOpen ? "linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(240,245,255,0.95) 50%, rgba(255,255,255,0.92) 100%)" : "transparent" }}
          onClick={() => setMobileOpen(false)}
        />
        <button className="absolute top-6 right-6 p-2 z-10" onClick={() => setMobileOpen(false)} aria-label="Close menu">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#686868" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div className={`relative h-full flex flex-col pt-24 px-8 transition-all duration-500 ${mobileOpen ? "translate-y-0 opacity-100" : "-translate-y-8 opacity-0"}`}>
          <div className="space-y-2">
            {[
              ["home", "Home", "100", "/"],
              ["news", "News & Insights", "150", null],
            ].map(([id, label, delay, href]) => (
              <button
                key={id as string}
                onClick={() => {
                  if (href) { window.location.href = href as string; }
                  setMobileOpen(false);
                }}
                className={`flex items-center gap-3 py-4 w-full text-left text-xl font-medium text-[#686868] hover:text-[#0F3DD1] transition-all duration-300 border-b border-gray-100 ${mobileOpen ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"}`}
                style={{ transitionDelay: mobileOpen ? `${delay}ms` : "0ms" }}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#0F3DD1]/30" />
                {label as string}
              </button>
            ))}
            <Link href="/login">
              <span
                className={`flex items-center gap-3 py-4 text-xl font-medium text-[#686868] hover:text-[#0F3DD1] transition-all duration-300 border-b border-gray-100 cursor-pointer ${mobileOpen ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"}`}
                style={{ transitionDelay: mobileOpen ? "250ms" : "0ms" }}
                onClick={() => setMobileOpen(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                Login
              </span>
            </Link>
          </div>
          <div className={`mt-8 transition-all duration-500 ${mobileOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`} style={{ transitionDelay: mobileOpen ? "350ms" : "0ms" }}>
            <Link href="/register">
              <span
                className="block w-full h-14 rounded-full text-lg font-semibold text-white text-center leading-[56px] cursor-pointer"
                style={{ background: "linear-gradient(135deg, #0F3DD1 0%, #1a4fe0 50%, #2961f0 100%)" }}
                onClick={() => setMobileOpen(false)}
              >
                Sign Up Free
              </span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Footer ───
function NewsFooter() {
  return (
    <footer className="py-8 sm:py-10 px-4 sm:px-6 border-t bg-background">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <img src={logoSrc} alt="A2A Global" className="h-8" />
              <span className="font-display font-bold text-base">Expert Opinion</span>
            </div>
            <p className="text-xs text-muted-foreground">AI-powered analysis, human-verified answers.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-xs">
            <div>
              <p className="font-semibold mb-2">Product</p>
              <div className="space-y-1.5 text-muted-foreground">
                <a href="/" className="block hover:text-primary transition-colors">How it Works</a>
                <a href="/#/register" onClick={(e) => { e.preventDefault(); window.location.hash = "/register"; }} className="block hover:text-primary transition-colors">Get Expert Review</a>
                <a href="/#/register?role=expert" onClick={(e) => { e.preventDefault(); window.location.hash = "/register?role=expert"; }} className="block hover:text-primary transition-colors">Become an Expert</a>
              </div>
            </div>
            <div>
              <p className="font-semibold mb-2">Portals</p>
              <div className="space-y-1.5 text-muted-foreground">
                <Link href="/login" className="block hover:text-primary transition-colors">Client Portal</Link>
                <a href="#/login?role=expert" onClick={(e) => { e.preventDefault(); window.location.hash = "/login?role=expert"; }} className="block hover:text-primary transition-colors">Expert Portal</a>
                <a href="#/register?role=expert" onClick={(e) => { e.preventDefault(); window.location.hash = "/register?role=expert"; }} className="block hover:text-primary transition-colors">Join as Expert</a>
              </div>
            </div>
            <div>
              <p className="font-semibold mb-2">Company</p>
              <div className="space-y-1.5 text-muted-foreground">
                <Link href="/news" className="block hover:text-primary transition-colors">News & Insights</Link>
                <a href="tel:+13026210214" className="block hover:text-primary transition-colors">+1 (302) 621-0214</a>
                <a href="mailto:support@a2a.global" className="block hover:text-primary transition-colors">support@a2a.global</a>
                <a href="https://a2a.global" target="_blank" rel="noopener" className="block hover:text-primary transition-colors">A2A Global</a>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t pt-4 flex flex-col md:flex-row justify-between items-center text-xs text-muted-foreground gap-2">
          <p>© 2026 A2A Global Inc. — Delaware C-Corp</p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="/cookies" className="hover:text-primary transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Main News Page ───
export default function NewsPage() {
  const [activeTab, setActiveTab] = useState("all");

  // Track pageview on mount
  useEffect(() => {
    fetch("/api/track/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "/news",
        utmSource: new URLSearchParams(window.location.hash.split("?")[1] || "").get("utm_source"),
        utmMedium: new URLSearchParams(window.location.hash.split("?")[1] || "").get("utm_medium"),
        utmCampaign: new URLSearchParams(window.location.hash.split("?")[1] || "").get("utm_campaign"),
        referrer: document.referrer,
      }),
    }).catch(() => {});
  }, []);

  // Set document title
  useEffect(() => {
    document.title = "AI News & Insights: Trust, Hallucination Research & Expert Economy | A2A Global";
  }, []);

  const byCategory = (cat: string) =>
    activeTab === "all" || activeTab === cat ? ARTICLES.filter((a) => a.category === cat) : [];

  const aiTransformation = byCategory("ai-transformation");
  const humanAI = byCategory("human-ai-collaboration");
  const remoteWork = byCategory("remote-work-ai-earnings");
  const studentReskilling = byCategory("student-reskilling");
  const enterpriseRisk = byCategory("sme-enterprise-ai-risk");
  const universityResearch = byCategory("university-research");
  const industryReports = byCategory("industry-reports");

  // Filter tabs for "all" pass-through — show all sections when "all" is active
  const showSection = (cat: string) =>
    activeTab === "all" || activeTab === cat;

  return (
    <div className="min-h-screen bg-[#F8FAFF]" data-testid="page-news">
      {/* SEO meta would go in head via Helmet if available, using title useEffect above */}

      <NewsNav />

      {/* ─── Hero ─── */}
      <section
        className="relative min-h-[480px] sm:min-h-[540px] flex items-center overflow-hidden"
        style={{ background: "linear-gradient(135deg, #081F6B 0%, #0F3DD1 60%, #1853F0 100%)" }}
      >
        {/* Subtle grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-16 sm:pb-20 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 mb-6">
            <BookOpen className="w-3.5 h-3.5 text-blue-200" />
            <span className="text-blue-200 text-xs font-semibold uppercase tracking-widest">News & Insights</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 leading-tight tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.4)]">
            AI IS TRANSFORMING EVERYTHING.
            <br />
            <span className="text-blue-200">THE QUESTION IS: CAN YOU TRUST IT?</span>
          </h1>
          <p className="text-blue-100/90 text-base sm:text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
            The latest research, analysis, and expert insights on AI reliability, the expert economy, and your competitive edge. 37 curated sources. One clear takeaway: human verification matters.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/#/register?role=client&utm_source=news&utm_medium=hero&utm_campaign=ai_trust"
              onClick={(e) => { e.preventDefault(); window.location.hash = "/register?role=client&utm_source=news&utm_medium=hero&utm_campaign=ai_trust"; }}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-white text-[#0F3DD1] text-base font-bold hover:bg-blue-50 transition-colors shadow-lg"
            >
              Get Expert Opinion <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="/#/register?role=expert&utm_source=news&utm_medium=hero&utm_campaign=become_expert"
              onClick={(e) => { e.preventDefault(); window.location.hash = "/register?role=expert&utm_source=news&utm_medium=hero&utm_campaign=become_expert"; }}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full border-2 border-white/40 text-white text-base font-bold hover:bg-white/10 transition-colors"
            >
              Become an Expert
            </a>
          </div>
          <p className="text-blue-200/70 text-xs mt-5">
            37 sources · Updated April 2026 · Free to read
          </p>
        </div>
      </section>

      {/* ─── Stats Bar ─── */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 text-center">
            {[
              { stat: "76%", label: "don't fully trust AI" },
              { stat: "48%", label: "hallucination rate (o4-mini)" },
              { stat: "9%", label: "trust generative AI (FT/IPA)" },
              { stat: "$225B", label: "AI funding in 2025" },
            ].map(({ stat, label }) => (
              <div key={stat}>
                <p className="text-2xl sm:text-3xl font-extrabold text-[#0F3DD1]">{stat}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Filter Tabs ─── */}
      <div className="sticky top-[72px] md:top-[84px] z-30 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto scrollbar-none py-3">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-[#0F3DD1] text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="flex gap-8 xl:gap-12 items-start">
          {/* Content Column */}
          <div className="flex-1 min-w-0">

            {/* ─── Section 1: AI Trust Crisis ─── */}
            {showSection("ai-transformation") && (
              <section id="section-ai-trust" className="mb-16">
                <SectionHeader
                  badge="AI Trust Crisis"
                  h2="76% of People Don't Trust AI — Here's What the Research Shows"
                  lead="The gap between AI adoption and AI trust is widening. Here's the evidence from TechCrunch, Wired, and the Financial Times."
                  icon={AlertTriangle}
                />

                {aiTransformation.length > 0 && (
                  <>
                    {/* Featured large card */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                      <ArticleCard article={aiTransformation[0]} featured={true} />
                    </div>

                    {/* 2-col grid for rest */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {aiTransformation.slice(1, 3).map((a) => (
                        <ArticleCard key={a.url} article={a} />
                      ))}
                    </div>

                    {/* CTA Banner after 2 articles */}
                    <CTABanner
                      variant="client"
                      headline="AI hallucinates. Your business decisions shouldn't."
                      subtext="Get a verified expert to review your AI-generated analysis. $5 free credits — results in hours, not days."
                      primaryLabel="Get Expert Review"
                      primaryHref="/#/register?role=client&utm_source=news&utm_medium=content&utm_campaign=ai_trust_crisis"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {aiTransformation.slice(3).map((a) => (
                        <ArticleCard key={a.url} article={a} />
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}

            {/* ─── Section 2: Expert Economy ─── */}
            {(showSection("human-ai-collaboration") || showSection("remote-work-ai-earnings")) && (
              <section id="section-expert-economy" className="mb-16">
                <SectionHeader
                  badge="Expert Economy"
                  h2="How Professionals Are Earning $50–$2,000 Per Review in the AI Verification Economy"
                  lead="From Mercor's $10B valuation to Google's AI rater network — the market for human expert judgment has never been larger."
                  icon={DollarSign}
                />

                {humanAI.length > 0 && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                      {humanAI.slice(0, 2).map((a) => (
                        <ArticleCard key={a.url} article={a} />
                      ))}
                    </div>

                    <CTABanner
                      variant="expert"
                      headline="Your expertise is worth more than you think."
                      subtext="Finance, business and strategy experts earn $50–200 per verified review. Set your own rate. Work from anywhere. Get paid in days."
                      primaryLabel="Apply as Expert"
                      primaryHref="/#/register?role=expert&utm_source=news&utm_medium=content&utm_campaign=expert_economy"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {humanAI.slice(2).map((a) => (
                        <ArticleCard key={a.url} article={a} />
                      ))}
                    </div>
                  </>
                )}

                {remoteWork.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                    {remoteWork.map((a) => (
                      <ArticleCard key={a.url} article={a} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ─── Section 3: Students & Career Changers ─── */}
            {showSection("student-reskilling") && (
              <section id="section-careers" className="mb-16">
                <SectionHeader
                  badge="Students & Careers"
                  h2="AI Is Reshaping Careers — Here's How Students and Professionals Are Adapting"
                  lead="47% of students have considered changing their major because of AI. Here's what Harvard, BCG, and Gallup are finding."
                  icon={GraduationCap}
                />

                {studentReskilling.length > 0 && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                      {studentReskilling.slice(0, 2).map((a) => (
                        <ArticleCard key={a.url} article={a} />
                      ))}
                    </div>

                    <CTABanner
                      variant="expert"
                      headline="Start building your expert profile while still in school."
                      subtext="No experience minimum for Standard tier. Earn while you learn. Build a verified track record that employers value."
                      primaryLabel="Join as Student Expert"
                      primaryHref="/#/register?role=expert&utm_source=news&utm_medium=content&utm_campaign=student_experts"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {studentReskilling.slice(2).map((a) => (
                        <ArticleCard key={a.url} article={a} />
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}

            {/* ─── Section 4: Enterprise AI Risk ─── */}
            {showSection("sme-enterprise-ai-risk") && (
              <section id="section-enterprise-risk" className="mb-16">
                <SectionHeader
                  badge="Enterprise Risk"
                  h2="The Hidden Cost of Trusting AI: Why Businesses Are Losing Millions"
                  lead="From GDPR fines to insurance pullbacks — the financial and legal risks of unverified AI are mounting fast."
                  icon={Building2}
                />

                {enterpriseRisk.length > 0 && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                      {enterpriseRisk.slice(0, 2).map((a) => (
                        <ArticleCard key={a.url} article={a} />
                      ))}
                    </div>

                    <CTABanner
                      variant="client"
                      headline="Don't let AI errors cost your business."
                      subtext="Enterprise-grade expert verification for AI-generated reports, analysis, and strategic recommendations. Compliance-ready. Results in hours."
                      primaryLabel="De-risk Your AI"
                      primaryHref="/#/register?role=client&utm_source=news&utm_medium=content&utm_campaign=enterprise_risk"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {enterpriseRisk.slice(2).map((a) => (
                        <ArticleCard key={a.url} article={a} />
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}

            {/* ─── Section 5: University Research ─── */}
            {showSection("university-research") && (
              <section id="section-research" className="mb-16">
                <SectionHeader
                  badge="Research & Academia"
                  h2="What MIT, Stanford, Harvard and CMU Are Discovering About AI Reliability"
                  lead="The world's leading research institutions are publishing peer-reviewed findings on AI hallucinations, oversight models, and verification — and they agree: human review is structurally necessary."
                  icon={BookOpen}
                />

                {universityResearch.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {universityResearch.map((a) => (
                      <ArticleCard key={a.url} article={a} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ─── Section 6: Industry Reports ─── */}
            {showSection("industry-reports") && (
              <section id="section-industry" className="mb-16">
                <SectionHeader
                  badge="Industry Intelligence"
                  h2="CB Insights, McKinsey & Gartner on the State of AI in 2026"
                  lead="The world's top analyst firms agree: AI is entering a governance and accountability phase. Human validation is the new competitive moat."
                  icon={BarChart3}
                />

                {industryReports.length > 0 && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                      {industryReports.slice(0, 2).map((a) => (
                        <ArticleCard key={a.url} article={a} />
                      ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {industryReports.slice(2).map((a) => (
                        <ArticleCard key={a.url} article={a} />
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}

            {/* ─── Final CTA Section ─── */}
            {activeTab === "all" && (
              <section id="section-final-cta" className="mb-10">
                <div className="rounded-3xl bg-gradient-to-br from-[#081F6B] via-[#0F3DD1] to-[#1853F0] p-8 sm:p-12 text-white">
                  <div className="text-center mb-10">
                    <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">"The AI revolution needs human experts. That's you."</h2>
                    <p className="text-blue-200 text-base sm:text-lg max-w-2xl mx-auto">
                      Whether you're an expert ready to monetize your knowledge, or a business that needs to trust its AI — A2A Global connects you.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                    {/* Expert Column */}
                    <div className="bg-white/10 rounded-2xl p-6 border border-white/20">
                      <div className="flex items-center gap-2 mb-4">
                        <Users className="w-5 h-5 text-green-300" />
                        <span className="font-bold text-base uppercase tracking-wide">For Experts</span>
                      </div>
                      <ul className="space-y-2.5 mb-6">
                        {[
                          "Join 1,000+ verified experts",
                          "Set your own rate",
                          "Earn $50–200 per review",
                          "Work from anywhere",
                          "No minimum commitment",
                        ].map((item) => (
                          <li key={item} className="flex items-center gap-2 text-sm text-blue-100">
                            <CheckCircle className="w-4 h-4 text-green-300 flex-shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                      <a
                        href="/#/register?role=expert&utm_source=news&utm_medium=content&utm_campaign=final_cta"
                        onClick={(e) => { e.preventDefault(); window.location.hash = "/register?role=expert&utm_source=news&utm_medium=content&utm_campaign=final_cta"; }}
                        className="block w-full text-center py-3 rounded-full bg-white text-[#0F3DD1] font-bold text-sm hover:bg-blue-50 transition-colors"
                      >
                        Become an Expert →
                      </a>
                    </div>

                    {/* Client Column */}
                    <div className="bg-white/10 rounded-2xl p-6 border border-white/20">
                      <div className="flex items-center gap-2 mb-4">
                        <Shield className="w-5 h-5 text-blue-200" />
                        <span className="font-bold text-base uppercase tracking-wide">For Businesses</span>
                      </div>
                      <ul className="space-y-2.5 mb-6">
                        {[
                          "76% of people don't trust AI",
                          "Get human-verified analysis",
                          "$5 free credits to start",
                          "Results in hours",
                          "No card required",
                        ].map((item) => (
                          <li key={item} className="flex items-center gap-2 text-sm text-blue-100">
                            <CheckCircle className="w-4 h-4 text-blue-200 flex-shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                      <a
                        href="/#/register?role=client&utm_source=news&utm_medium=content&utm_campaign=final_cta"
                        onClick={(e) => { e.preventDefault(); window.location.hash = "/register?role=client&utm_source=news&utm_medium=content&utm_campaign=final_cta"; }}
                        className="block w-full text-center py-3 rounded-full bg-white text-[#0F3DD1] font-bold text-sm hover:bg-blue-50 transition-colors"
                      >
                        Get Expert Review →
                      </a>
                    </div>
                  </div>

                  {/* Trust signals */}
                  <div className="flex flex-wrap justify-center gap-4 mt-8 pt-8 border-t border-white/20">
                    {[
                      { icon: TrendingUp, text: "37 curated sources" },
                      { icon: Shield, text: "Human-verified results" },
                      { icon: Zap, text: "Results in hours" },
                      { icon: CheckCircle, text: "$5 free credits" },
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} className="flex items-center gap-2 text-sm text-blue-200">
                        <Icon className="w-4 h-4" />
                        {text}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

          </div>

          {/* Sticky Sidebar */}
          <StickySidebar />
        </div>
      </main>

      <NewsFooter />
    </div>
  );
}
