import type { LessonContent, LessonStep } from "@/modules/training/lesson"

const POLICY =
  "Your provider's policy for this topic sets the local steps. Use it with what you learn here."

type Choice = {
  prompt: string
  correct: string
  wrong: [string, string]
  feedback?: string
}

type SituationChoice = {
  label: string
  outcome: string
  safe: boolean
}

type Situation = {
  title: string
  scene: string
  prompt: string
  choices: [SituationChoice, SituationChoice, SituationChoice]
}

type Section = {
  slug: string
  title: string
  paragraphs: [string, string]
  points: [string, string, string]
  checks: [Choice, Choice]
}

type CourseSpec = {
  code: string
  title: string
  description: string
  audience: string
  standards: string
  requirement_status: string
  required: boolean
  renewal_months: number
  cover_image: string
  image: string
  sections: [Section, Section, Section, Section]
  scenario: [Situation, Situation, Situation]
  exam: [Choice, Choice, Choice, Choice, Choice, Choice, Choice, Choice]
}

function decisionOrder<T extends { safe: boolean }>(choices: T[]) {
  const safe = choices.filter((choice) => choice.safe)
  const unsafe = choices.filter((choice) => !choice.safe)
  if (safe.length !== 1 || unsafe.length === 0) return choices
  const middle = Math.floor(unsafe.length / 2)
  return [...unsafe.slice(0, middle), safe[0], ...unsafe.slice(middle)]
}

function options(choice: Choice) {
  return [
    { id: "a", label: choice.correct },
    { id: "b", label: choice.wrong[0] },
    { id: "c", label: choice.wrong[1] },
  ]
}

function lessonFor(course: CourseSpec): LessonContent {
  const steps: LessonStep[] = []
  course.sections.forEach((section, index) => {
    const paragraphs =
      index === 0
        ? [section.paragraphs[0], `${section.paragraphs[1]} ${POLICY}`]
        : [...section.paragraphs]
    steps.push({
      id: `${course.code}-${section.slug}`,
      kind: "learn",
      kicker: "Education",
      title: section.title,
      paragraphs,
      points: [...section.points],
      image: { src: course.image, alt: section.title },
    })
    section.checks.forEach((choice, checkIndex) => {
      steps.push({
        id: `${course.code}-${section.slug}-c${checkIndex + 1}`,
        kind: "check",
        kicker: "Check your learning",
        title: section.title,
        prompt: choice.prompt,
        options: options(choice),
        correct_option_id: "a",
        feedback: choice.feedback ?? choice.correct,
        image: {
          src: "/training/library/check.svg",
          alt: "A short check on the lesson you just finished.",
        },
      })
    })
  })
  course.scenario.forEach((situation, index) => {
    steps.push({
      id: `${course.code}-sit${index + 1}`,
      kind: "situation",
      kicker: "Situation",
      title: situation.title,
      scene: situation.scene,
      prompt: situation.prompt,
      choices: decisionOrder(situation.choices).map((choice, choiceIndex) => ({
        id: String.fromCharCode(97 + choiceIndex),
        label: choice.label,
        outcome: choice.outcome,
        safe: choice.safe,
      })),
    })
  })
  steps.push({
    id: `${course.code}-exam`,
    kind: "exam",
    kicker: "Check your understanding",
    title: course.title,
    intro:
      "Answer from what this course has taught you. You need 80% to show you can use it in your work.",
    questions: course.exam.map((choice, index) => ({
      id: `${course.code}-q${index + 1}`,
      prompt: choice.prompt,
      options: options(choice),
      correct_option_id: "a",
    })),
  })
  return { version: 1, steps }
}

function course(spec: CourseSpec) {
  return {
    code: spec.code,
    title: spec.title,
    description: spec.description,
    audience: spec.audience,
    standards: spec.standards,
    requirement_status: spec.requirement_status,
    kind: "course" as const,
    family: spec.code.startsWith("CC-")
      ? "Complex care"
      : "Provision of supports",
    renewal_months: spec.renewal_months,
    required: spec.required,
    pass_mark: 80,
    cover_image: spec.cover_image,
    parent: null,
    lesson: lessonFor(spec),
  }
}

const optional = "Optional until you choose a role in Settings → Courses."

export const registrationCourses = [
  course({
    code: "CC-09",
    title: "Diabetes Management",
    description:
      "Theory for supporting a participant with diabetes: recognising low and high blood glucose, following their diabetes management plan, and recording what you did. A qualified health practitioner signs off the practical competency separately.",
    audience: "Role-specific",
    standards:
      "Supplementary module: High Intensity Daily Personal Activities; NDIS High Intensity Support Skills Descriptor: diabetes management",
    requirement_status:
      "Explicitly required for workers delivering this support; practical competency sign-off by a qualified health practitioner required",
    required: true,
    renewal_months: 12,
    cover_image: "/training/library/complex-care.svg",
    image: "/training/library/complex-care.svg",
    sections: [
      {
        slug: "plan",
        title: "Follow this person's plan",
        paragraphs: [
          "Diabetes support is a high intensity skill when you check blood glucose, recognise a low or high reading, or support insulin. The participant's diabetes management plan says which of those tasks you may do.",
          "Do only the tasks in that plan, and only the tasks a health practitioner has signed you off to do. Type 1 and type 2 are managed differently. The plan decides the response.",
        ],
        points: [
          "The plan sets the tasks you may do",
          "This theory course is not the practical sign-off",
          "Do not invent a dose or a treatment",
        ],
        checks: [
          {
            prompt:
              "A colleague says a sweet biscuit worked for another participant. What do you do here?",
            correct: "Follow this participant's diabetes management plan",
            wrong: [
              "Give the same biscuit, because it worked last time",
              "Skip the plan because you have supported diabetes before",
            ],
            feedback:
              "The plan for this person decides the response. Another participant's routine is not authority to treat.",
          },
          {
            prompt: "What does finishing this course leave still to be done?",
            correct: "A practical sign-off by a qualified health practitioner",
            wrong: [
              "Nothing. The certificate is the competency",
              "A verbal okay from a colleague on shift",
            ],
            feedback:
              "Theory does not replace the practical sign-off for diabetes support.",
          },
        ],
      },
      {
        slug: "low",
        title: "Low blood glucose",
        paragraphs: [
          "A low reading can look like sweating, shaking, hunger, confusion, pale skin, or a sudden change in behaviour. If the person can swallow safely, give the fast-acting glucose named in the plan, then the longer-acting carbohydrate it names, and recheck.",
          "If they cannot swallow, are unconscious, or are not recovering as the plan describes, do not put food or fluid in their mouth. Follow the emergency steps in the plan and call an ambulance.",
        ],
        points: [
          "Treat a low reading only as the plan describes",
          "Nothing by mouth if they cannot swallow",
          "Call an ambulance when they are unconscious or not recovering",
        ],
        checks: [
          {
            prompt:
              "The person is sweaty and confused, and they can swallow safely. What do you do?",
            correct:
              "Give the fast-acting glucose named in the plan, then recheck",
            wrong: [
              "Give insulin to settle the symptoms",
              "Wait until the end of the shift and write it up then",
            ],
            feedback:
              "A low reading is treated with the fast-acting glucose in the plan, then a recheck. Insulin is not the treatment for a low.",
          },
          {
            prompt: "The person is unconscious. What do you do?",
            correct:
              "Do not give food or drink. Follow the emergency steps and call an ambulance",
            wrong: [
              "Pour a sweet drink into their mouth",
              "Give extra insulin and recheck in an hour",
            ],
            feedback:
              "Nothing goes in the mouth of a person who cannot swallow. Follow the emergency steps and call an ambulance.",
          },
        ],
      },
      {
        slug: "high",
        title: "High readings, checks, and insulin",
        paragraphs: [
          "Thirst, passing urine often, tiredness, vomiting, or breath that smells sweet can be a high reading. Record the number from their meter or sensor and follow the plan. Do not give an insulin dose the plan does not authorise.",
          "Use their own meter, lancets, pen, and needles. Do not share them. Put used sharps straight into a sharps container. Giving an injection sits with the subcutaneous injections sign-off as well as this plan.",
        ],
        points: [
          "Record the reading you actually took",
          "Insulin only as prescribed and as you are signed off",
          "Their equipment only, and sharps into a sharps container",
        ],
        checks: [
          {
            prompt:
              "The reading is high and the person is vomiting. What do you do?",
            correct:
              "Follow the plan's high-glucose and sick-day steps and contact the person it names",
            wrong: [
              "Calculate a correcting dose yourself and give it",
              "Offer a large sugary drink to give them energy",
            ],
            feedback:
              "A high reading and vomiting is a sick-day response from the plan, including who to contact. You do not invent a dose.",
          },
          {
            prompt: "Where does a used needle go?",
            correct: "Straight into a sharps container",
            wrong: [
              "The kitchen bin",
              "Recapped and left on the table until later",
            ],
            feedback:
              "Used sharps go straight into a sharps container. They do not go in a household bin or stay out on a surface.",
          },
        ],
      },
      {
        slug: "record",
        title: "What you write down",
        paragraphs: [
          "Write the time, the reading, what you gave or did, and how the person responded. A blank note is not a record of a safe response.",
          "On a sick day, follow the plan's sick-day rules and contact the health practitioner it names. Report an incident if the person was harmed or there was a serious near miss.",
        ],
        points: [
          "Time, reading, action, and response",
          "Sick-day steps come from the plan",
          "Harm or a serious near miss is an incident",
        ],
        checks: [
          {
            prompt:
              "You treated a low reading and the person recovered. What belongs in the note?",
            correct:
              "The time, the reading, what you gave, and how they responded",
            wrong: [
              "Only that the shift was fine",
              "The reading, and nothing about what you did",
            ],
            feedback:
              "The note needs the time, the reading, the action, and the response. Without the action, the record does not show what kept the person safe.",
          },
          {
            prompt:
              "The person did not recover and needed an ambulance. What else happens?",
            correct: "Report it as an incident",
            wrong: [
              "Leave it in the progress note only",
              "Wait and see if they mention it later",
            ],
            feedback:
              "Harm, and a response that needed emergency care, is an incident as well as a progress note.",
          },
        ],
      },
    ],
    scenario: [
      {
        title: "Pale and shaky before breakfast",
        scene:
          "Before breakfast the person is pale and shaky. They can swallow. Their plan says 15 grams of fast-acting glucose, then a recheck in 15 minutes.",
        prompt: "What do you do first?",
        choices: [
          {
            label: "Give the 15 grams named in the plan",
            outcome:
              "You give the glucose from the plan and set a timer for the recheck. The shaking eases. The breakfast insulin stays in the kit until the plan says it is due.",
            safe: true,
          },
          {
            label: "Give their usual breakfast insulin first",
            outcome:
              "The insulin drops their glucose further. They become confused, and the breakfast you were about to start is no longer safe to give.",
            safe: false,
          },
          {
            label: "Start the shower and check again afterwards",
            outcome:
              "They are unsteady in the shower while the low is still untreated. You are now managing a fall risk and a low reading at the same time.",
            safe: false,
          },
        ],
      },
      {
        title: "They have recovered",
        scene:
          "Fifteen minutes later they are themselves again. The recheck matches the plan.",
        prompt: "What do you write?",
        choices: [
          {
            label:
              "The time, both readings, what you gave, and that they recovered",
            outcome:
              "The next worker can see what happened, what you gave, and that the recheck matched the plan. The record shows how the low was treated.",
            safe: true,
          },
          {
            label: "Nothing, because they recovered",
            outcome:
              "The next shift starts with no record of the low. If it happens again, nobody can see the pattern or what worked.",
            safe: false,
          },
          {
            label: "Only the second reading",
            outcome:
              "The note shows a number and nothing else. It does not say they were pale and shaky, or that you gave the glucose that settled it.",
            safe: false,
          },
        ],
      },
      {
        title: "An early dose",
        scene:
          "They ask you to give tomorrow's insulin dose early so the morning is easier. The plan does not allow that.",
        prompt: "What do you do?",
        choices: [
          {
            label: "Decline, and follow the plan",
            outcome:
              "The dose stays on the time the plan sets. You explain that, and the morning continues with the tasks you are signed off to do.",
            safe: true,
          },
          {
            label: "Give it early so the morning is easier",
            outcome:
              "The early dose is not in the plan. Their glucose falls before the meal that was meant to go with it, and you have given a medicine you were not authorised to move.",
            safe: false,
          },
          {
            label: "Give half of it as a compromise",
            outcome:
              "Half a dose is still a dose the plan does not authorise. You have changed the prescription on the spot, and the reading later does not match what the plan expected.",
            safe: false,
          },
        ],
      },
    ],
    exam: [
      {
        prompt: "Who decides which diabetes tasks you may do?",
        correct:
          "The participant's diabetes management plan, and your practical sign-off",
        wrong: [
          "Whatever worked for the last participant",
          "Your own judgement on the day",
        ],
      },
      {
        prompt:
          "The person can swallow and has low-glucose symptoms. What is the first response?",
        correct: "The fast-acting glucose named in the plan, then a recheck",
        wrong: ["Insulin", "Wait until the end of the shift"],
      },
      {
        prompt: "The person is unconscious. What must you not do?",
        correct: "Put food or fluid in their mouth",
        wrong: ["Call an ambulance", "Follow the emergency steps in the plan"],
      },
      {
        prompt: "A high reading with vomiting is handled by:",
        correct:
          "The plan's high-glucose and sick-day steps, including who to contact",
        wrong: ["A dose you calculate yourself", "A large sugary drink"],
      },
      {
        prompt: "Insulin equipment is:",
        correct:
          "The participant's own, and used sharps go into a sharps container",
        wrong: [
          "Shared across the house if the dose matches",
          "Thrown in the kitchen bin when you are finished",
        ],
      },
      {
        prompt: "A progress note after a low reading includes:",
        correct: "Time, reading, what you did, and how the person responded",
        wrong: ["That the shift was uneventful", "The reading only"],
      },
      {
        prompt: "An ambulance was needed. Besides the progress note, you:",
        correct: "Report an incident",
        wrong: [
          "Wait to see if anyone asks",
          "Remove the note so the record stays short",
        ],
      },
      {
        prompt: "This course, on its own, means:",
        correct:
          "You have done the theory. The practical sign-off is still separate",
        wrong: [
          "You may invent doses",
          "You are signed off for every diabetes task",
        ],
      },
    ],
  }),
  course({
    code: "PS-06",
    title: "Early Childhood Supports",
    description:
      "How early childhood supports follow the child and family, build the family's capacity, and judge success by participation rather than by hours delivered.",
    audience: "Early childhood workers and leaders",
    standards:
      "Supplementary module: Early childhood supports; Registration group 0118",
    requirement_status: optional,
    required: false,
    renewal_months: 12,
    cover_image: "/training/library/supports.svg",
    image: "/training/library/supports.svg",
    sections: [
      {
        slug: "child",
        title: "The child leads",
        paragraphs: [
          "Early childhood supports are built around the child in ordinary life: home, community, and early learning. The diagnosis does not set the visit. The child's routines, and what the family wants the child to take part in, do.",
          "The child is included in choices in a way that fits their age. You slow down, offer real options, and watch what they move toward.",
        ],
        points: [
          "Routines come before the diagnosis",
          "The child gets a real choice",
          "Home, community, and early learning are the setting",
        ],
        checks: [
          {
            prompt: "What should shape the visit?",
            correct:
              "The child's routines and what the family wants the child to take part in",
            wrong: [
              "The diagnosis, regardless of the day",
              "The activity you prepared before you arrived",
            ],
            feedback:
              "The visit follows the child's ordinary routines and the family's priorities, not a plan you made without them.",
          },
          {
            prompt: "How is a young child included in a decision?",
            correct:
              "With real options, at their pace, watching what they choose",
            wrong: [
              "By asking them to sign the service agreement",
              "By deciding for them so the session stays on time",
            ],
            feedback:
              "Inclusion matches the child's age: real options, enough time, and attention to what they choose.",
          },
        ],
      },
      {
        slug: "family",
        title: "The family's capacity",
        paragraphs: [
          "Your job is to leave the family more able to use the strategy when you are not there. You show it inside the routine, the family tries it, and you adjust.",
          "You do not take over care the family wants to keep. You also do not hand them a strategy they cannot do with the time and equipment they actually have.",
        ],
        points: [
          "The family can use it after you leave",
          "You do not take over their role",
          "The strategy has to fit their day",
        ],
        checks: [
          {
            prompt: "A strategy is useful when:",
            correct: "The family can use it in the routine after you have left",
            wrong: [
              "It only works while you are in the room doing it for them",
              "It needs equipment the family does not have",
            ],
            feedback:
              "Capacity building means the family can carry the strategy on. A strategy that only works in your hands has not done that.",
          },
          {
            prompt:
              "The family wants to keep doing the bedtime routine themselves. What do you do?",
            correct:
              "Coach the routine they want to keep, and do not take it over",
            wrong: [
              "Do bedtime for them so it is done properly",
              "Write a new routine and ask them to stop theirs",
            ],
            feedback:
              "You build on the care the family wants to keep. Taking it over removes the capacity you are there to build.",
          },
        ],
      },
      {
        slug: "evidence",
        title: "Evidence, and what you stop",
        paragraphs: [
          "Use approaches that have a reason for this child, and watch whether participation actually changes. If a strategy is not helping after you have tried it as agreed, stop and review it with the family and the team.",
          "Behaviour support and restrictive practice rules still apply. You do not use restraint, seclusion, or a chemical restraint to make a session easier.",
        ],
        points: [
          "Watch whether participation changes",
          "Stop what is not helping",
          "Restrictive practices are not a session tool",
        ],
        checks: [
          {
            prompt:
              "You have used a strategy as agreed and participation has not changed. What do you do?",
            correct: "Stop and review it with the family and the team",
            wrong: [
              "Keep going so the hours are delivered",
              "Add a restrictive practice to get through the activity",
            ],
            feedback:
              "If participation is not changing, the strategy is reviewed. Hours delivered are not a reason to continue it, and restriction is not a way to force it.",
          },
          {
            prompt: "Which tool is out of bounds for making a session easier?",
            correct: "Restraint, seclusion, or a chemical restraint",
            wrong: [
              "A shorter activity the child can finish",
              "A change of routine agreed with the family",
            ],
            feedback:
              "Restrictive practices are not a convenience. Change the activity or the routine instead.",
          },
        ],
      },
      {
        slug: "outcomes",
        title: "Outcomes, not hours",
        paragraphs: [
          "A useful goal is something the child does in real life: joining a meal, playing beside another child, moving between activities. Hours delivered are not the outcome.",
          "Write what the child and family did, what changed, and what you will try next. That record is how the plan stays honest.",
        ],
        points: [
          "Goals are participation in real life",
          "Hours are not the outcome",
          "The note says what changed",
        ],
        checks: [
          {
            prompt: "Which goal matches this module?",
            correct: "The child joins the family meal three evenings a week",
            wrong: [
              "The worker delivers four hours a week",
              "The child sits quietly for the whole visit",
            ],
            feedback:
              "The outcome is participation in ordinary life. Hours delivered, or compliance for its own sake, is not the goal.",
          },
          {
            prompt: "What does the note need to show?",
            correct:
              "What the child and family did, what changed, and what you will try next",
            wrong: [
              "Only the hours you attended",
              "A judgement about the family's effort",
            ],
            feedback:
              "The record is about participation and the next step, not a timesheet and not a verdict on the family.",
          },
        ],
      },
    ],
    scenario: [
      {
        title: "Packing the kinder bag",
        scene:
          "You arrive with a craft activity. The child is in the middle of helping a parent pack a bag for kinder.",
        prompt: "What do you do?",
        choices: [
          {
            label: "Join that routine and practise the goal inside it",
            outcome:
              "You pack the bag with them. The goal is practised in the routine that was already happening, and the craft waits.",
            safe: true,
          },
          {
            label: "Stop the routine so the craft can start on time",
            outcome:
              "The bag is left half packed and the parent finishes it later, without the child. The visit runs to your activity, and the routine you came to support does not happen.",
            safe: false,
          },
          {
            label: "Wait in another room until they are finished",
            outcome:
              "The packing finishes without you. You have missed the moment the goal was available, and the craft starts after the useful part of the morning is over.",
            safe: false,
          },
        ],
      },
      {
        title: "They can do the step",
        scene:
          "The parent can do the packing step after you model it once.",
        prompt: "What is the better next move?",
        choices: [
          {
            label: "Let them do it, and adjust only what did not work",
            outcome:
              "They pack the bag. You step in only for the part that stalled, and that part is the one you will practise next time.",
            safe: true,
          },
          {
            label: "Keep doing it yourself so it is faster",
            outcome:
              "The bag is packed on time, and the parent watches. Next visit they still wait for you to do it, because the step never became theirs.",
            safe: false,
          },
          {
            label: "Add three new steps before they have this one",
            outcome:
              "The morning now has more steps than the family can hold. The one they had just learned gets dropped, and the visit feels harder than last time.",
            safe: false,
          },
        ],
      },
      {
        title: "The goodbye has not changed",
        scene:
          "After four visits the child is still not joining the kinder goodbye.",
        prompt: "What do you record?",
        choices: [
          {
            label:
              "That participation has not changed, and that you will review the strategy",
            outcome:
              "The record shows the goodbye is unchanged and that the strategy will be reviewed with the family. The next visit starts from that, not from a claim that the goal is done.",
            safe: true,
          },
          {
            label: "That four hours were delivered, so the goal is met",
            outcome:
              "The file says the goal is met because you attended. The child is still not joining the goodbye, and the next worker has no reason to change anything.",
            safe: false,
          },
          {
            label: "That the child was non-compliant",
            outcome:
              "The note blames the child. It does not say what was tried, what the family wanted, or what will change, so the strategy stays as it is.",
            safe: false,
          },
        ],
      },
    ],
    exam: [
      {
        prompt: "Early childhood support is built around:",
        correct: "The child's ordinary routines and the family's priorities",
        wrong: ["The diagnosis alone", "The activity the worker prepared"],
      },
      {
        prompt: "A young child takes part in decisions by:",
        correct: "Real options, enough time, and attention to what they choose",
        wrong: [
          "Signing the service agreement",
          "The worker deciding, to stay on time",
        ],
      },
      {
        prompt: "A strategy has built capacity when:",
        correct: "The family can use it after you leave",
        wrong: [
          "It only works while you do it",
          "It needs equipment they do not have",
        ],
      },
      {
        prompt: "The family wants to keep a routine. You:",
        correct: "Coach it and do not take it over",
        wrong: ["Do it for them", "Replace it with your own"],
      },
      {
        prompt: "Participation has not changed. You:",
        correct: "Stop and review the strategy with the family and the team",
        wrong: ["Keep delivering hours", "Add a restrictive practice"],
      },
      {
        prompt: "Restraint in a session is:",
        correct: "Not a tool for making the session easier",
        wrong: ["Fine if it saves time", "A normal early childhood strategy"],
      },
      {
        prompt: "A matching goal is:",
        correct: "The child joins the family meal",
        wrong: ["The worker delivers four hours", "The child stays quiet"],
      },
      {
        prompt: "The note records:",
        correct:
          "What the child and family did, what changed, and the next step",
        wrong: ["Hours only", "A judgement of the family"],
      },
    ],
  }),
  course({
    code: "PS-07",
    title: "Specialist Disability Accommodation",
    description:
      "The enrolled dwelling is separate from daily support. Covers conflict of interest, the service agreement, and the tenancy.",
    audience: "SDA leaders and office",
    standards:
      "Supplementary module: Specialist disability accommodation; Registration group 0131",
    requirement_status: optional,
    required: false,
    renewal_months: 24,
    cover_image: "/training/library/governance.svg",
    image: "/training/library/governance.svg",
    sections: [
      {
        slug: "dwelling",
        title: "The dwelling is not the support",
        paragraphs: [
          "Specialist disability accommodation is the enrolled dwelling. Daily personal support is a different service, and often a different provider. Do not treat the house and the support roster as one product.",
          "The dwelling has to stay enrolled for its design category. Who the participant lives with is part of the offer, within the enrolment and the agreement.",
        ],
        points: [
          "SDA is the dwelling",
          "Daily support is a separate service",
          "The enrolment and design category have to stay true",
        ],
        checks: [
          {
            prompt: "What is SDA?",
            correct:
              "The enrolled dwelling, separate from daily personal support",
            wrong: [
              "The roster of support workers in the house",
              "Any house a participant lives in",
            ],
            feedback:
              "SDA is the enrolled dwelling. The support delivered inside it is a different service.",
          },
          {
            prompt: "A participant asks who else will live in the house. You:",
            correct:
              "Treat that choice as part of the offer, within the enrolment and the agreement",
            wrong: [
              "Fill the vacancy with whoever is next on your list, and tell them later",
              "Say the support provider decides who lives there",
            ],
            feedback:
              "Who someone lives with is part of the SDA offer. It is not a decision you make after they have moved in, and it is not the support provider's decision.",
          },
        ],
      },
      {
        slug: "conflict",
        title: "Conflict of interest",
        paragraphs: [
          "Do not pressure a participant to take daily support from you, or from a related provider, as the price of the dwelling. Offer the dwelling on its own terms.",
          "Where there is a related-party arrangement, say so in a way the participant can understand, and record that they had a choice.",
        ],
        points: [
          "The dwelling is not conditional on your support",
          "Related parties are declared",
          "The choice is recorded",
        ],
        checks: [
          {
            prompt:
              "Your organisation also delivers daily support. What do you tell the participant?",
            correct:
              "That the dwelling does not depend on them choosing your support, and that a related party exists",
            wrong: [
              "That the dwelling is only available with your support roster",
              "Nothing, unless they ask who owns the company",
            ],
            feedback:
              "The dwelling stands on its own. A related support provider is declared, and the participant can choose someone else.",
          },
          {
            prompt: "What do you keep on the record?",
            correct:
              "That you declared the conflict and the choice the participant made",
            wrong: [
              "Only the lease start date",
              "Nothing, if they chose your related provider",
            ],
            feedback:
              "The declaration and the choice are the record. Choosing you does not remove the need to write it down.",
          },
        ],
      },
      {
        slug: "agreement",
        title: "The agreement",
        paragraphs: [
          "The SDA service agreement is in writing. It says what the dwelling provides, what the participant pays, how repairs are handled, and how the agreement can end.",
          "The participant can have someone support them to understand it. Do not start the stay on a verbal deal the agreement does not match.",
        ],
        points: [
          "The agreement is written",
          "It covers price, repairs, and how it ends",
          "A verbal deal does not replace it",
        ],
        checks: [
          {
            prompt:
              "Which document sets the price, the repairs, and how the stay can end?",
            correct: "The written SDA service agreement",
            wrong: ["A text message about the rent", "The support plan"],
            feedback:
              "Price, repairs, and ending the agreement belong in the written SDA service agreement.",
          },
          {
            prompt: "The participant wants help to read the agreement. You:",
            correct:
              "Make room for the person they choose to help them understand it",
            wrong: [
              "Ask them to sign now so the vacancy is not lost",
              "Summarise it and skip the document",
            ],
            feedback:
              "They can have support to understand the agreement. Rushing a signature is not that support.",
          },
        ],
      },
      {
        slug: "tenancy",
        title: "Tenancy",
        paragraphs: [
          "The right to live there is a tenancy or occupancy right. It is not the same document as the support plan, and ending support does not by itself end the tenancy.",
          "Notice, access for repairs, and ending the stay follow the agreement and tenancy law. Safety and repairs of the dwelling sit with the SDA provider.",
        ],
        points: [
          "Tenancy is separate from the support plan",
          "Ending support does not end the tenancy",
          "Repairs and safety sit with the SDA provider",
        ],
        checks: [
          {
            prompt:
              "Daily support at the house ends. What happens to the tenancy?",
            correct:
              "It continues until it is ended under the agreement and tenancy law",
            wrong: [
              "It ends the same day, because the support ended",
              "The support provider decides whether they can stay",
            ],
            feedback:
              "The tenancy is a separate right. Ending support does not end it.",
          },
          {
            prompt: "A grab rail is loose. Who is responsible for the repair?",
            correct: "The SDA provider, under the agreement",
            wrong: [
              "The support worker on the next shift",
              "The participant, because they use it",
            ],
            feedback:
              "Safety and repairs of the dwelling sit with the SDA provider.",
          },
        ],
      },
    ],
    scenario: [
      {
        title: "They already have a support provider",
        scene:
          "A participant wants the dwelling. They already have a different provider for daily support. Your organisation also offers daily support.",
        prompt: "What do you offer?",
        choices: [
          {
            label:
              "The dwelling on its own, with the related-party arrangement explained",
            outcome:
              "They can take the dwelling and keep their current support provider. The fact that you also offer daily support is explained, and it is not a condition of the offer.",
            safe: true,
          },
          {
            label: "The dwelling only if they move their daily support to you",
            outcome:
              "The dwelling is withheld unless they change provider. They do not have a real choice about who supports them at home, and the conflict was never declared as a choice.",
            safe: false,
          },
          {
            label: "Daily support first, and the dwelling later if a room is free",
            outcome:
              "You have turned a housing enquiry into a support sale. The room they asked about is not actually offered, and the two services are tied together.",
            safe: false,
          },
        ],
      },
      {
        title: "The advocate has not read it",
        scene:
          "They want their advocate to read the agreement before signing. The room is vacant now.",
        prompt: "What do you do?",
        choices: [
          {
            label: "Wait so the advocate can help them understand the agreement",
            outcome:
              "The room stays vacant until the advocate has gone through the agreement with them. They sign knowing what the stay includes.",
            safe: true,
          },
          {
            label: "Start the stay on a handshake and send the agreement later",
            outcome:
              "They move in before they have seen the terms. When the agreement arrives, the parts they would have questioned are already in force.",
            safe: false,
          },
          {
            label: "Tell them the room will go unless they sign today",
            outcome:
              "They sign to keep the room, without the advocate they asked for. The agreement is in place, and they cannot say what they agreed to.",
            safe: false,
          },
        ],
      },
      {
        title: "The support provider changes",
        scene:
          "Six months later their daily support provider changes. They ask if they have to move out.",
        prompt: "What is true?",
        choices: [
          {
            label:
              "The tenancy continues. Changing support provider does not end it",
            outcome:
              "They stay. The tenancy follows the agreement, and the change of support provider is recorded without a notice to leave.",
            safe: true,
          },
          {
            label: "They must leave because the support changed",
            outcome:
              "You end the tenancy because a different organisation now provides daily support. They lose their home over a change the tenancy did not depend on.",
            safe: false,
          },
          {
            label: "They can stay only if the new provider is one of yours",
            outcome:
              "Staying is made conditional on using your support service. The tenancy and the daily support are tied together again, six months after they moved in.",
            safe: false,
          },
        ],
      },
    ],
    exam: [
      {
        prompt: "SDA is:",
        correct: "The enrolled dwelling, separate from daily support",
        wrong: ["The support roster", "Any house a participant rents"],
      },
      {
        prompt: "Who a participant lives with is:",
        correct: "Part of the offer, within the enrolment and the agreement",
        wrong: [
          "Decided after they move in",
          "Decided by the support provider",
        ],
      },
      {
        prompt: "A related support provider must be:",
        correct: "Declared, with a real choice to use someone else",
        wrong: [
          "Hidden unless the participant asks",
          "Required if they want the dwelling",
        ],
      },
      {
        prompt: "The record of a conflict includes:",
        correct: "The declaration and the choice the participant made",
        wrong: ["Only the lease date", "Nothing, if they chose you"],
      },
      {
        prompt: "Price, repairs, and ending the stay belong in:",
        correct: "The written SDA service agreement",
        wrong: ["A text message", "The support plan"],
      },
      {
        prompt: "Before signing, the participant may:",
        correct: "Have someone help them understand the agreement",
        wrong: [
          "Be asked to sign so the vacancy is not lost",
          "Rely on a verbal summary instead of the document",
        ],
      },
      {
        prompt: "Ending daily support:",
        correct: "Does not by itself end the tenancy",
        wrong: [
          "Ends the tenancy the same day",
          "Lets the support provider decide if they stay",
        ],
      },
      {
        prompt: "A repair to the dwelling sits with:",
        correct: "The SDA provider",
        wrong: [
          "The support worker on shift",
          "The participant, because they use it",
        ],
      },
    ],
  }),
  course({
    code: "PS-08",
    title: "Support Coordination",
    description:
      "Connect the participant to supports in their plan, offer a real choice when there is a conflict of interest, and record the decision they made.",
    audience: "Support coordinators",
    standards:
      "Supplementary module: Specialised support coordination; Registration groups 0106 and 0132",
    requirement_status: optional,
    required: false,
    renewal_months: 12,
    cover_image: "/training/library/governance.svg",
    image: "/training/library/governance.svg",
    sections: [
      {
        slug: "role",
        title: "The job",
        paragraphs: [
          "Support coordination connects the participant to supports that are already in their plan, and helps them build the skill to do that themselves when that is the goal. You do not rewrite the plan and you do not quietly replace it.",
          "Specialised support coordination is the same job in a more complex situation. The conflict and record rules do not relax because the situation is complex.",
        ],
        points: [
          "You connect supports that are in the plan",
          "You do not rewrite the plan",
          "Complexity does not relax the rules",
        ],
        checks: [
          {
            prompt:
              "A participant asks you to add a support the plan does not fund. What is your role?",
            correct:
              "Explain what the plan funds, and help them pursue a change if that is the right path",
            wrong: [
              "Book the support and sort the funding out later",
              "Rewrite the plan so the booking fits",
            ],
            feedback:
              "Coordination implements the plan. Changing what is funded is a plan process, not a booking you make on the side.",
          },
          {
            prompt: "Specialised support coordination changes which rules?",
            correct: "None. Conflict and record rules still apply",
            wrong: [
              "You may refer to your own provider without saying so",
              "Notes are optional because the work is complex",
            ],
            feedback:
              "Specialised coordination is the same duty in a harder situation. The conflict and record rules stay.",
          },
        ],
      },
      {
        slug: "conflict",
        title: "Conflict of interest",
        paragraphs: [
          "If your organisation, or a related one, could deliver the support, say so before the participant chooses. Offer other providers where the market has them.",
          "Record the conflict, the options you offered, and the choice the participant made. A referral to yourself with no record of a choice is not coordination.",
        ],
        points: [
          "Declare the conflict before they choose",
          "Offer other providers where they exist",
          "Record the options and the choice",
        ],
        checks: [
          {
            prompt:
              "Your organisation delivers the support the participant needs. What do you do before they choose?",
            correct:
              "Say so, and offer other providers where the market has them",
            wrong: [
              "Refer them to your service and move on",
              "Mention it only if they complain later",
            ],
            feedback:
              "The conflict is declared before the choice, and other providers are offered where they exist.",
          },
          {
            prompt:
              "They choose your organisation. What does the note contain?",
            correct:
              "The conflict, the options offered, and the choice they made",
            wrong: [
              "Only the start date with your service",
              "Nothing, because they were happy to choose you",
            ],
            feedback:
              "Choosing you is still a choice that has to be recorded, with the options that were offered.",
          },
        ],
      },
      {
        slug: "gaps",
        title: "When supports are not happening",
        paragraphs: [
          "Check that funded supports are actually being delivered. If there is a gap, help the participant resolve it. Delivering the support yourself is a different role and needs its own authority.",
          "Escalate when there is no support, a risk of harm, or the plan no longer meets the need. Waiting for the next scheduled review is not a response to an unsafe gap.",
        ],
        points: [
          "Check that funded supports are happening",
          "Do not quietly become the support worker",
          "An unsafe gap is escalated now",
        ],
        checks: [
          {
            prompt:
              "A funded support has not been delivered for three weeks. What do you do?",
            correct:
              "Help the participant resolve the gap, and escalate if there is a risk of harm",
            wrong: [
              "Deliver the shifts yourself so the plan looks active",
              "Leave it until the next plan review",
            ],
            feedback:
              "You resolve the gap with the participant. You do not become the support, and you do not wait out a risk.",
          },
          {
            prompt:
              "There is no support in place and the participant is at risk. When do you escalate?",
            correct: "Now, not at the next scheduled review",
            wrong: [
              "At the next plan review",
              "Only if the participant writes to you twice",
            ],
            feedback: "An unsafe gap is escalated when you know about it.",
          },
        ],
      },
      {
        slug: "record",
        title: "The record and the ending",
        paragraphs: [
          "Notes say who you spoke with, which options were offered, and what the participant decided. They do not need the participant's NDIS number repeated as a label for the person.",
          "When coordination ends, hand over what is in place, what is unresolved, and who the participant wants contacted. Do not leave the next person to reconstruct it from memory.",
        ],
        points: [
          "Who, which options, and what they decided",
          "Leave the NDIS number out of the note",
          "Handover covers what is open",
        ],
        checks: [
          {
            prompt: "A coordination note needs:",
            correct:
              "Who you spoke with, the options offered, and the decision",
            wrong: [
              "The NDIS number in the subject line",
              "Only that you had a chat",
            ],
            feedback:
              "The note is the conversation, the options, and the decision. The NDIS number is not how you identify the note.",
          },
          {
            prompt: "Coordination is ending. The handover includes:",
            correct:
              "What is in place, what is unresolved, and who the participant wants contacted",
            wrong: [
              "A request that the next person read the whole file and work it out",
              "Only your last appointment date",
            ],
            feedback:
              "Handover says what is in place, what is open, and who to contact. The next person should not have to reconstruct it.",
          },
        ],
      },
    ],
    scenario: [
      {
        title: "Your organisation can also deliver the support",
        scene:
          "The plan funds support coordination and in-home support. Your organisation can deliver the in-home support. Two other providers have capacity.",
        prompt: "What do you do?",
        choices: [
          {
            label: "Tell them about the conflict and offer all three providers",
            outcome:
              "They hear that your organisation is one of the options, and they also hear about the two others with capacity. They choose from the three.",
            safe: true,
          },
          {
            label: "Book your own service, since you already know the participant",
            outcome:
              "The in-home support is booked with you before they have heard there was a choice. The conflict is in the roster, and it is not in the note.",
            safe: false,
          },
          {
            label: "Offer only your service and say the others are full",
            outcome:
              "They accept your service because they were told there was no alternative. The other two providers had capacity, and the choice was never real.",
            safe: false,
          },
        ],
      },
      {
        title: "The mornings are uncovered",
        scene:
          "They choose one of the other providers. A week later no shifts have started, and mornings are unsafe.",
        prompt: "What do you do?",
        choices: [
          {
            label: "Work with them to close the gap now, and escalate the risk",
            outcome:
              "You contact the provider, look at who else has capacity, and escalate the risk the same day. The mornings are treated as an open risk, not as something that can wait.",
            safe: true,
          },
          {
            label: "Cover the morning shifts yourself",
            outcome:
              "You become the support worker. The conflict you had set aside is now the roster, and the coordination role is mixed with delivering the support.",
            safe: false,
          },
          {
            label: "Wait for the twelve-week review",
            outcome:
              "The mornings stay unsafe until the review date. The gap is on the file as a future agenda item, and nothing changes this week.",
            safe: false,
          },
        ],
      },
      {
        title: "You are leaving",
        scene: "You are leaving the role. The morning gap is still open.",
        prompt: "What do you hand over?",
        choices: [
          {
            label:
              "What is in place, the open gap, and who the participant wants contacted",
            outcome:
              "The next coordinator can see what is funded, which mornings are still unsafe, and who to call. They start from the gap, not from an empty file.",
            safe: true,
          },
          {
            label: "The NDIS number and a note that says see file",
            outcome:
              "The handover identifies the person and nothing about the support. The next coordinator has to reconstruct the gap, and the unsafe mornings continue while they do.",
            safe: false,
          },
          {
            label: "Nothing, because the new coordinator can call the providers",
            outcome:
              "There is no record of who was chosen, what is in place, or that mornings are uncovered. The new coordinator starts from scratch, and the participant repeats it.",
            safe: false,
          },
        ],
      },
    ],
    exam: [
      {
        prompt: "Support coordination:",
        correct: "Connects the participant to supports already in the plan",
        wrong: [
          "Rewrites the plan to match a booking",
          "Books unfunded supports and fixes it later",
        ],
      },
      {
        prompt: "Specialised support coordination:",
        correct: "Follows the same conflict and record rules",
        wrong: ["Can hide a conflict", "Does not need notes"],
      },
      {
        prompt: "Before the participant chooses your related service, you:",
        correct:
          "Declare the conflict and offer other providers where they exist",
        wrong: ["Refer them and move on", "Mention it only if they complain"],
      },
      {
        prompt: "If they choose you, the note still includes:",
        correct: "The conflict, the options, and the choice",
        wrong: ["Only the start date", "Nothing"],
      },
      {
        prompt: "A funded support is not being delivered. You:",
        correct: "Help them resolve the gap, and escalate a risk of harm",
        wrong: ["Deliver the shifts yourself", "Wait for the next review"],
      },
      {
        prompt: "An unsafe gap is escalated:",
        correct: "When you know about it",
        wrong: [
          "At the next scheduled review",
          "After a second written complaint",
        ],
      },
      {
        prompt: "A coordination note contains:",
        correct: "Who you spoke with, the options, and the decision",
        wrong: ["The NDIS number as the label", "Only that you spoke"],
      },
      {
        prompt: "When coordination ends, handover covers:",
        correct: "What is in place, what is unresolved, and who to contact",
        wrong: [
          "A pointer to the whole file",
          "The last appointment date only",
        ],
      },
    ],
  }),
  course({
    code: "PS-09",
    title: "Behaviour Support for Practitioners",
    description:
      "For practitioners who develop behaviour support plans. Workers who implement a plan someone else wrote do that in Positive Behaviour Support in Practice.",
    audience: "Behaviour support practitioners",
    standards:
      "Supplementary module: Specialist behaviour support; NDIS (Restrictive Practices and Behaviour Support) Rules 2018; Registration group 0110",
    requirement_status: optional,
    required: false,
    renewal_months: 12,
    cover_image: "/training/library/supports.svg",
    image: "/training/library/supports.svg",
    sections: [
      {
        slug: "who",
        title: "Who this course is for",
        paragraphs: [
          "This course is for practitioners who assess behaviour and develop behaviour support plans. A support worker implementing a plan someone else wrote does that under Positive Behaviour Support in Practice.",
          "A plan is built with the person, the people who support them, and the providers who will implement it. A plan written in isolation will not be followed.",
        ],
        points: [
          "This is for the practitioner who writes the plan",
          "Implementing a plan is a different course",
          "The people who will use the plan help write it",
        ],
        checks: [
          {
            prompt: "Who is this course for?",
            correct:
              "A practitioner who assesses behaviour and develops the plan",
            wrong: [
              "A support worker implementing a plan on shift",
              "Any worker who has read about behaviour",
            ],
            feedback:
              "This course is the practitioner role. Implementing a plan on shift is Positive Behaviour Support in Practice.",
          },
          {
            prompt: "A plan is most likely to be used when:",
            correct:
              "The person and the providers who will implement it helped build it",
            wrong: [
              "It was written from the file without speaking to the people on shift",
              "It uses strategies the house has already said they cannot do",
            ],
            feedback:
              "The people who will implement the plan have to be in the work. A plan they cannot do will not be followed.",
          },
        ],
      },
      {
        slug: "restrictive",
        title: "Restrictive practices",
        paragraphs: [
          "A regulated restrictive practice is a last resort, authorised as the rules require, and the least restriction that will prevent harm. It is not a convenience and it is not a punishment.",
          "The plan includes the strategies that make the restrictive practice less necessary, and a path to reduce and remove it. An authorisation without that path is incomplete.",
        ],
        points: [
          "Last resort, authorised, and the least restriction",
          "Not a convenience or a punishment",
          "The plan has to show how it will be reduced",
        ],
        checks: [
          {
            prompt:
              "A provider asks for a restrictive practice because shifts are short staffed. What is the right response?",
            correct:
              "Decline. Short staffing is not a reason to authorise a restrictive practice",
            wrong: [
              "Add it so the roster can cope",
              "Add it for a month and review if staffing improves",
            ],
            feedback:
              "A restrictive practice is to prevent harm, as a last resort. It is not a staffing strategy.",
          },
          {
            prompt: "An authorisation is incomplete when:",
            correct:
              "The plan has no strategies to reduce and remove the practice",
            wrong: [
              "The provider finds the strategies inconvenient",
              "The person has used the practice before",
            ],
            feedback:
              "The plan has to contain the path off the restrictive practice. Authorisation without that path is incomplete.",
          },
        ],
      },
      {
        slug: "interim",
        title: "Interim plans and incidents",
        paragraphs: [
          "An interim plan covers a short, defined period while the full assessment is done. It is not a permanent plan with a different name.",
          "Use of a regulated restrictive practice that was not in the plan, or that injured the person, is reported under the incident rules. You review the plan. You do not ask the provider to leave it out of the record.",
        ],
        points: [
          "Interim means a short, defined period",
          "Unauthorised or harmful use is an incident",
          "You do not ask anyone to leave it out of the record",
        ],
        checks: [
          {
            prompt:
              "An interim plan has been in place for a long stretch with no assessment booked. What is true?",
            correct:
              "It is no longer doing the job of an interim plan. The full assessment has to proceed",
            wrong: [
              "Interim plans can run indefinitely if the provider is busy",
              "Rename it as a comprehensive plan without the assessment",
            ],
            feedback:
              "Interim is a defined wait for the full assessment. It does not become a comprehensive plan by lasting longer.",
          },
          {
            prompt:
              "A restrictive practice was used and it was not in the plan. The provider asks you to keep it out of the incident record. You:",
            correct: "Refuse. It is reported, and you review the plan",
            wrong: [
              "Agree, so the provider is not penalised",
              "Record it only in your private notes",
            ],
            feedback:
              "Use that was not in the plan is reported. You review the plan. You do not help leave it out of the record.",
          },
        ],
      },
      {
        slug: "review",
        title: "Review",
        paragraphs: [
          "Review whether the proactive strategies are being used and whether the restrictive practice is reducing. A plan that is not implemented is a finding, not a reason to add more restriction.",
          "The people who implement the plan can tell you what is possible on a shift. Change the plan with them, then say what changed and why.",
        ],
        points: [
          "Check that proactive strategies are actually used",
          "A plan that is not implemented is a finding",
          "Changes are made with the people who use the plan",
        ],
        checks: [
          {
            prompt:
              "The proactive strategies are not being used, and the provider wants another restriction. What do you do?",
            correct:
              "Treat the unused strategies as the finding, and do not add restriction to cover that",
            wrong: [
              "Add the restriction so something is in place",
              "Close the review because the provider is frustrated",
            ],
            feedback:
              "Unused strategies are the finding. More restriction does not repair a plan that is not being implemented.",
          },
          {
            prompt: "You change a strategy. What do the implementers need?",
            correct:
              "What changed and why, agreed with the people who will use it",
            wrong: [
              "A new document filed without telling the house",
              "A verbal aside to one worker",
            ],
            feedback:
              "The people who implement the plan need to know what changed and why, and they need to have been part of the change.",
          },
        ],
      },
    ],
    scenario: [
      {
        title: "A request to lock the pantry",
        scene:
          "A provider asks you to write a plan that lets them lock the pantry, because food budgeting is hard and a previous plan did not mention it.",
        prompt: "What do you do first?",
        choices: [
          {
            label:
              "Find out what the behaviour is and whether a less restrictive strategy can meet the need",
            outcome:
              "You start with what is actually happening around food, and with what else could meet the need. The lock is not written in until that is done, and only if it is the least restriction that prevents harm.",
            safe: true,
          },
          {
            label: "Add the lock so the budget is protected",
            outcome:
              "The plan now authorises a lock for convenience. Food access is restricted without a behaviour assessment, and the budget problem is treated as a restrictive practice.",
            safe: false,
          },
          {
            label: "Copy the request into an interim plan that does not expire",
            outcome:
              "The lock is in force with no end date. What was asked for as a stopgap becomes the ongoing plan, and the full assessment never replaces it.",
            safe: false,
          },
        ],
      },
      {
        title: "The roster cannot run the strategy",
        scene:
          "The house says they cannot run the proactive strategy on the current roster.",
        prompt: "What do you change?",
        choices: [
          {
            label:
              "The plan, with them, so the strategy is one they can actually do",
            outcome:
              "You change the strategy with the people who will use it. The next version is something the current roster can do, and they know what changed and why.",
            safe: true,
          },
          {
            label: "Nothing. Implementation is their problem",
            outcome:
              "The strategy stays in the plan and stays unused. The review later finds a plan that was never implemented, and the behaviour is unchanged.",
            safe: false,
          },
          {
            label:
              "Add a restrictive practice to replace the strategy they will not do",
            outcome:
              "Restriction is added because the roster is short. The person is now restricted to cover a strategy the house said they could not run.",
            safe: false,
          },
        ],
      },
      {
        title: "A practice that was not in the plan",
        scene:
          "During the month a worker used a restrictive practice that was not in the plan, and the person was hurt. The manager asks you to leave it off the incident report.",
        prompt: "What do you do?",
        choices: [
          {
            label:
              "Refuse, expect the incident to be reported, and review the plan",
            outcome:
              "The incident is reported, including the practice that was not in the plan and the harm. You review the plan with the people who implement it.",
            safe: true,
          },
          {
            label: "Leave it off and extend the interim plan",
            outcome:
              "The harm is missing from the incident report, and the interim plan is stretched to cover a practice that was used outside it. The record no longer matches what happened.",
            safe: false,
          },
          {
            label: "Note it privately and wait for the annual review",
            outcome:
              "The injury sits in a private note until the annual review. The provider's incident record does not show it, and the plan stays as it was on the day the person was hurt.",
            safe: false,
          },
        ],
      },
    ],
    exam: [
      {
        prompt: "This course is for:",
        correct: "Practitioners who develop behaviour support plans",
        wrong: [
          "Support workers implementing a plan on shift",
          "Anyone who has read about behaviour",
        ],
      },
      {
        prompt: "A plan is built:",
        correct: "With the person and the providers who will implement it",
        wrong: [
          "From the file, without the people on shift",
          "Around strategies the house has said they cannot do",
        ],
      },
      {
        prompt: "A restrictive practice is:",
        correct:
          "A last resort, authorised, and the least restriction that prevents harm",
        wrong: ["A way to cover a short roster", "A consequence for behaviour"],
      },
      {
        prompt: "Authorisation is incomplete without:",
        correct: "Strategies to reduce and remove the practice",
        wrong: [
          "The provider's agreement that it is convenient",
          "Evidence the practice was used before",
        ],
      },
      {
        prompt: "An interim plan:",
        correct:
          "Covers a short, defined period while the full assessment is done",
        wrong: [
          "Can run indefinitely",
          "Becomes comprehensive if you change the title",
        ],
      },
      {
        prompt:
          "A restrictive practice used outside the plan, where the person was hurt, is:",
        correct: "Reported as an incident, and the plan is reviewed",
        wrong: [
          "Left out of the record if the provider asks",
          "Kept in a private note until the annual review",
        ],
      },
      {
        prompt: "Proactive strategies are not being used. You:",
        correct:
          "Treat that as the finding, and do not add restriction to cover it",
        wrong: ["Add another restriction", "Close the review"],
      },
      {
        prompt: "When a strategy changes, implementers need:",
        correct: "What changed and why, agreed with the people who will use it",
        wrong: [
          "A filed document and no conversation",
          "A verbal aside to one worker",
        ],
      },
    ],
  }),
]
