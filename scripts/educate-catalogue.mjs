#!/usr/bin/env node
/**
 * Rewrites platform course lessons so each section teaches the topic.
 * Questions stay as a check after the teaching. Step ids and order stay the same.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { rest } from "./lesson-rest.mjs"
import { rest as restMore } from "./lesson-rest-2.mjs"

const path = new URL("../modules/training/library/catalogue.json", import.meta.url)
const catalogue = JSON.parse(readFileSync(path, "utf8"))

const descriptions = {
  "RR-13":
    "How to protect a participant's personal and health information, share it only with consent and on a need-to-know basis, and keep their dignity during personal care and in records.",
  "RR-14":
    "How to support Aboriginal and Torres Strait Islander people, people from culturally and linguistically diverse communities, people of faith, and LGBTIQA+ participants so the support feels safe to them.",
  "GO-08":
    "How leaders keep support safe and honest all year: what good practice looks like, how to read your own records, and how to fix gaps while they still matter to the person.",
  "GO-14":
    "How to write progress notes that tell the next worker what happened, what the person chose, and how they responded, in plain factual language.",
  "PS-04":
    "How access, service agreements, pricing changes, and transitions work so a participant can understand the service, agree to it, and move without losing support.",
  "PS-05":
    "How supported independent living works inside a shared home: each person's plan and privacy, house-level risks, and records that show how that person actually lives.",
  "SE-02":
    "How coughs and sneezes spread infection, and how to cover, catch, and clean so people you support are protected.",
  "SE-05":
    "How infection spreads and how to stop it on an ordinary shift: hand hygiene, respiratory hygiene, protective equipment, cleaning, and what to do when several people are unwell.",
  "SE-18":
    "How to handle a participant's money and belongings only as they have authorised, record every transaction, and notice financial abuse.",
  "CP-02":
    "A short return to hand hygiene, protective equipment, and respiratory hygiene so you can still use them on shift.",
}

function teachIntro(intro, kind) {
  const theory = /qualified health practitioner/.test(intro)
  if (kind === "checkpoint") {
    return "Answer from the practice you just reviewed. You need 80% to show you can still use it. If you are not there yet, complete the full course."
  }
  let text =
    "Answer from what this course has taught you. You need 80% to show you can use it in your work."
  if (theory) {
    text +=
      " This is the theory. A qualified health practitioner still signs off your practical competency before you deliver this support."
  }
  return text
}

function paragraphsFor(course, lesson) {
  const written = LESSONS[`${course.code}|${lesson.title}`]
  if (!written) {
    throw new Error(`Missing education for ${course.code} | ${lesson.title}`)
  }
  return written
}

function learnSteps(course) {
  return course.lesson.steps.filter((step) => step.kind === "learn")
}

function parentCourses(entry, byCode) {
  return String(entry.parent ?? "")
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean)
    .map((code) => byCode.get(code))
    .filter(Boolean)
}

function teachBite(bite, byCode) {
  const custom = BITES[bite.code]
  if (custom) return custom
  const parent = byCode.get(bite.parent)
  const focus = learnSteps(parent).find((step) => step.title === BITE_FOCUS[bite.code])
  const source = focus ?? learnSteps(parent)[0]
  return [
    source.paragraphs[0],
    `${source.paragraphs[1]} This is a short return to the idea. The full course goes further.`,
  ]
}

function teachCheckpoint(entry, byCode) {
  const parents = parentCourses(entry, byCode)
  const chunks = parents.flatMap((parent) =>
    learnSteps(parent)
      .slice(0, 2)
      .map((step) => step.paragraphs[0])
  )
  const first = chunks.slice(0, 2).join(" ")
  const second = chunks.slice(2, 4).join(" ")
  return [
    first || entry.title,
    second
      ? `${second} The questions after this check that you can still use the practice.`
      : "The questions after this check that you can still use the practice.",
  ]
}

function teachHub(entry, byCode) {
  const steps = []
  for (const parent of parentCourses(entry, byCode)) {
    for (const step of learnSteps(parent).slice(0, 2)) {
      steps.push({
        id: `${entry.code.toLowerCase()}-${step.id}`,
        kind: "learn",
        kicker: "Education",
        title: `${parent.code}: ${step.title}`,
        paragraphs: step.paragraphs,
        points: step.points ?? [],
        image: {
          src: "/training/library/hubs.svg",
          alt: step.title,
        },
      })
    }
  }
  const exam = entry.lesson.steps.find((step) => step.kind === "exam")
  if (exam) {
    steps.push({
      ...exam,
      intro: "You have read the teaching for this topic. These questions check that you can use it. This session does not replace the full course.",
    })
  }
  return steps
}

const AUDIT =
  /in this part|guarantee an audit|stand up at audit|what auditors look for|training registers as evidence|what the audit samples/i

const BITE_FOCUS = {
  "B-01": "What abuse and neglect look like",
  "B-02": "Responding to a disclosure",
  "B-03": "Reporting",
  "B-04": "Responding",
  "B-05": "Reportable incidents",
  "B-06": "Recording",
  "B-13": "Standard precautions",
  "B-14": "Waste streams",
  "B-15": "Storage",
  "B-16": "Sharps and waste",
  "B-17": "Hoists",
  "B-19": "Sit-to-stand and walking",
  "B-20": "In bed",
  "B-21": "Slide sheets and boards",
  "B-22": "Wheelchairs",
  "B-23": "Car transfers",
  "B-24": "Roles and authority",
  "B-25": "The rights",
}

const BITES = {
  "B-07": [
    "Chemical restraint is medication given to control behaviour, not to treat a diagnosed condition. That includes a PRN given because someone is distressed, loud, or refusing a task. The same medicine can be treatment in one situation and a restraint in another. The behaviour support plan says which is which.",
    "You do not give it because the shift is hard or because it worked yesterday. If it is authorised, you follow the plan's conditions: when, how much, and what else you try first. If it is not in the plan, you do not give it, and you report the request. Any use is recorded so the practitioner can see whether the practice is reducing.",
  ],
  "B-08": [
    "Emotional regulation is a person's ability to feel a strong emotion and get back to a state where they can take part. Many people you support are still building that skill, or they lose it when they are in pain, frightened, hungry, or overloaded. Behaviour in that moment is communication, not a choice to ruin the shift.",
    "You help by lowering demands, keeping your voice slow, and offering the strategy in their plan: space, a known person, a sensory item, a change of room. You do not lecture, restrain, or threaten a consequence while they are flooded. Afterwards, when they are calm, you can talk about what happened if they want to. You record what led up to it and what helped.",
  ],
  "B-09": [
    "Environmental restraint restricts a person's free access to places or things they would otherwise use. Locked doors, gates, cupboards, fridges, and devices can all be environmental restraint when they are used to control a person, even if the house calls them 'just how we do things'. A lock for everyone's ordinary safety, such as a pool gate, is different from a lock that stops one person leaving their room.",
    "If a restriction is in the behaviour support plan and authorised, you use only that restriction, for the time and purpose it names, and you record it. You do not add a lock because it makes the shift easier. If you find a restriction that is not in the plan, you stop using it where it is safe to do so, and you report it.",
  ],
  "B-10": [
    "Mechanical restraint is a device used to restrict movement, such as a strap, belt, splint, or table that a person cannot undo, when the purpose is to control behaviour. A device the person uses for posture or safety, and can release, or that a therapist has prescribed for a physical reason, is not automatically a restraint. The plan tells you which is which.",
    "You use an authorised device only as the plan describes, you check skin and comfort, and you take it off as soon as the plan says to. You never tie, wedge, or strap someone in place because there are not enough staff. Unauthorised use is reported.",
  ],
  "B-11": [
    "Physical restraint is using your body to stop a person moving, when the purpose is to control behaviour. Holding someone's hands down, sitting on them, or pinning them to a chair are physical restraint. Guiding a hand during personal care, with their agreement, is not. The difference is force and purpose.",
    "You do not use physical restraint to finish a task, win an argument, or keep to the clock. If a plan authorises a specific hold as a last resort to prevent serious harm, you use only that hold, for the shortest time, and you release as soon as the harm has passed. You record it the same day. Any other hold is reported.",
  ],
  "B-12": [
    "Seclusion is putting a person alone in a room or area and stopping them from leaving. Shutting a door and holding it, or telling someone they cannot come out until they calm down, is seclusion even if you stay nearby and call it 'time away'. A person choosing to be in their room, with the door able to open, is not seclusion.",
    "Seclusion is a regulated restrictive practice. You use it only when it is in the behaviour support plan, authorised, and the last resort to prevent serious harm. You stay responsible for their safety the whole time, you end it as soon as you can, and you record the start, the finish, and what you tried first. If it is not authorised, you do not do it, and you report anyone who does.",
  ],
  "B-18": [
    "A stand hoist supports a person who can bear some weight and follow the steps, to move between sitting surfaces. It is not a shortcut for someone who cannot stand. The manual handling plan says whether this person uses a stand hoist, which sling, and whether you need a second worker.",
    "Check the service tag and the load limit before you start. Fit the sling as the plan shows, explain each step, and stop if the person is in pain or their feet are not taking weight. You do not swap in a full-body sling, a different loop, or a one-person attempt because the second worker is late. If the hoist fails, tag it out and report it. Do not invent another way to lift.",
  ],
}

function L(paragraphs) {
  return paragraphs
}

const LESSONS = {
  "RR-01|What abuse and neglect look like": L([
    "Abuse is harm done to a person. Physical abuse includes hitting, pushing, rough handling, and force used to get a task done. Sexual abuse is any sexual act, exposure, or comment without free consent, including where the person cannot consent. Emotional and psychological abuse is threats, humiliation, isolation, or constant criticism that wears someone down. Financial abuse and exploitation is taking money, property, or benefits, or pressuring someone to hand them over.",
    "Neglect is care that does not happen. Active neglect is refusing care you know the person needs. Passive neglect is not noticing that they have not eaten, been changed, or had their medication. Discrimination and systemic abuse is when rules, routines, or attitudes treat a person as less, or shut them out of ordinary life. You notice harm through the body (injuries, pain, weight loss), through behaviour (fear, withdrawal, a new sexualised act), and through the place (no food, a locked room, missing belongings).",
  ]),
  "RR-01|Why risk is higher": L([
    "People who rely on others for personal care, meals, money, or communication have less room to protect themselves. A person who needs you to get out of bed cannot easily leave a shift that feels wrong. If they communicate in ways other people dismiss, a disclosure can be written off as confusion or behaviour. That is why you take what they show you seriously the first time.",
    "Risk rises in closed settings: a house with few visitors, a shift with one worker, a van, a bedroom with the door shut. Isolation means fewer people see what happens. There is also a power difference on every shift. You know the system, you can leave at the end of the shift, and you are often physically stronger. They live with the consequences. You use that difference to protect them, never to get your own way.",
  ]),
  "RR-01|Recognising it in practice": L([
    "Watch for change, not a textbook picture. A person may become withdrawn, angry, or frightened of a particular worker. Money or belongings go missing. They stop wanting to go somewhere they used to enjoy. Injuries they cannot explain, or an explanation that changes each time you ask, need a closer look. Bruises in different stages of healing, marks that match a hand or a strap, and pain during personal care are physical signs.",
    "Also watch other workers. A colleague who insists on working alone with someone, who mocks them, who takes them to the bank, or who is secretive about a shift is a warning. Grooming is a pattern: gifts, secrets, special treatment, slowly crossing a physical boundary, and isolating the person from family or other staff. One kind act is not grooming. A pattern that builds secrecy and dependence is. You do not need proof. You report what you noticed.",
  ]),
  "RR-01|Responding to a disclosure": L([
    "If someone tells you they have been hurt, listen and believe them enough to act. You do not interview them, ask leading questions, or make them repeat the story for each new person. Your job is safety, not the investigation. Meet immediate medical needs first. If they are injured, bleeding, or in pain, get health care. If they are unsafe with a person who is still there, separate them.",
    "Say you are glad they told you, that they are not in trouble, and that you will get help. Do not promise secrecy. You will have to tell the people whose job it is to protect them. Leave clothing, bedding, and the place as they are when you can do that without leaving the person unsafe. Do not confront the person they named. Confrontation can silence them, destroy evidence, and put you both at risk. Write down the words they used, as soon as you can, and report.",
  ]),
  "RR-01|Reporting": L([
    "Tell your provider through the incident pathway the same shift, not at the end of the week. Say what you saw or were told, who was there, and what you did. Do not wait to be sure. The people who assess the report decide what happens next. If a child is involved, police and the child-protection report in your state may be required as well as the internal report. Do that immediately. Do not agree to 'keep it in the house'.",
    "Some events are reportable to the NDIS Commission. Death, serious injury, abuse or neglect, unlawful sexual or physical contact, and sexual misconduct are reported within 24 hours. You tell your provider so they can make that notification. You are protected when you report in good faith. Retaliation for raising a safety concern is itself a breach. If you fear reprisal, you can also complain directly to the Commission.",
  ]),
  "RR-02|What counts as a biohazard": L([
    "A biohazard is something that can carry infection. In support work that means blood, urine, faeces, vomit, saliva, and fluid from a wound. You treat them as infectious even when the person is well and even when you know them. You do not decide by looking that a fluid is 'only a little bit' and therefore safe.",
    "Sharps are needles, lancets, razors, and anything else that can puncture skin. Contaminated dressings, continence aids, and used gloves or gowns are biohazards too, because fluid sits on them. They do not go loose in a kitchen bin, a handbag, or the back of a car. You contain them, and you clean your hands after.",
  ]),
  "RR-02|Standard precautions": L([
    "Standard precautions are the habits you use with every person, on every shift, whether or not an infection has been diagnosed. Treat every body fluid as infectious. That protects the participant and you, and it avoids treating one person as 'the infectious one'.",
    "Choose protective equipment for the task in front of you. Gloves for personal care and body fluids. An apron or gown if fluid may splash your clothes. Eye and mask protection if fluid may hit your face. Clean your hands before you touch the person and again after you remove gloves. Gloves do not replace hand hygiene. They come off between tasks, and your hands are cleaned again.",
  ]),
  "RR-02|Spills and clean-up": L([
    "A spill kit holds what you need before you start: gloves, an apron, eye protection if there is splash, absorbent material, a disinfectant the provider uses, bags, and a scoop or scraper. Know where it is in the house or the vehicle before you need it. Do not go looking for a tea towel once blood is on the floor.",
    "The order is contain, absorb, clean, disinfect, dispose. Stop the spill spreading, soak it up, clean the surface, then disinfect for the contact time on the product. Clothing and linen that are soiled go into a bag at the point of use, not shaken out in the hallway. Wash them as the provider directs, separately from ordinary washing when that is the instruction. Then clean your hands.",
  ]),
  "RR-02|Sharps and waste": L([
    "Used sharps go straight into an approved sharps container, at the place you used them. The container is rigid, labelled, and not filled past the line. It is not a drink bottle, a plastic bag, or the kitchen bin.",
    "Never recap a needle, and never bend or snap it. Most needle-stick injuries happen when someone tries to make a used needle 'safer' by hand. Clinical waste (material soaked with blood or body fluid) is a different stream from ordinary household rubbish. If you are unsure which bag to use, ask before you throw it in with the recycling or the kitchen waste.",
  ]),
  "RR-02|If you are exposed": L([
    "If a needle punctures your skin, let the wound bleed, wash it with soap and water, and do not scrub or suck it. If fluid splashes your eyes, mouth, or broken skin, rinse with plenty of water. Do this immediately, before you finish the rest of the task.",
    "Tell your supervisor the same shift and get medical advice straight away. Some exposures need treatment within hours, so waiting until tomorrow is the wrong call. Write down what happened, what fluid it was, and what you did. That record is how you get the right follow-up, and how the next person avoids the same exposure.",
  ]),
  "RR-03|What bullying is and is not": L([
    "Bullying at work is repeated unreasonable behaviour that creates a risk to health and safety. It is not a single sharp comment, and it is not a personality clash on its own. It becomes bullying when it is repeated and a reasonable person would see a risk to someone's health.",
    "It can look like being left out of handovers, intimidated on a shift, loaded with the tasks no one else will do, or humiliated in front of a participant. Reasonable management action is different. A supervisor can raise performance, change a roster fairly, or give a lawful direction, if they do it reasonably. A single incident can still be harassment or assault and still needs a response. It is just not called bullying unless it is repeated.",
  ]),
  "RR-03|Bullying in support settings": L([
    "Shared shifts make bullying easy to hide. It can be two workers freezing a third out of decisions, mocking how they support someone, or dumping the heavy personal care on them every time. The participant feels that atmosphere even when the words are not aimed at them.",
    "Workers can also bully participants: controlling their day, mocking their speech or body, withholding a drink, a cigarette, or a community outing as punishment. Group chats and roster apps count. Messages that humiliate a colleague or a participant are still bullying when they are repeated. Screenshot them and report them. Do not pile on, and do not forward them for a joke.",
  ]),
  "RR-03|Impact": L([
    "Bullying causes psychosocial injury. People lose sleep, dread shifts, make mistakes, and eventually leave. That injury is real even when there is no bruise.",
    "The support gets worse. A frightened worker rushes personal care, skips a handover, or stops speaking up when something is unsafe. A participant who is mocked stops asking for help. If you see it and say nothing, you are part of how it continues. You do not have to confront the person in the moment if that is unsafe. You do have to tell someone who can act.",
  ]),
  "RR-03|What to do": L([
    "Speak up early if you can do it safely. A calm sentence — 'that handover left me out, and I need to be included' — sometimes stops a pattern before it sets. If it continues, or if you are not safe to say it, use the reporting pathway. You can tell your team leader, and you can go around them if they are the person involved. The report is kept as confidential as the investigation allows.",
    "Use the employee assistance program or another support if the behaviour is affecting your health. You do not have to wait until you are in crisis. In more serious cases a worker can apply to the Fair Work Commission for an order to stop bullying. That sits alongside the provider's process. It does not replace telling the provider what is happening.",
  ]),
  "RR-04|Why change is hard in support work": L([
    "Support teams are often casual, split across houses, and working while the people they support are asleep or out. A change announced in one meeting misses most of the workforce. People hear a fragment on a shift and fill the gaps with rumour.",
    "Teams also carry change fatigue. A new roster, a new app, and a new form in the same month feel like the work is never allowed to settle. Trust depends on what happened last time. If the last change was sprung on people, or a promise was broken, they will hear the next message as a threat. You plan for that. You do not call them resistant for remembering.",
  ]),
  "RR-04|Planning the message": L([
    "Say what is changing, why, when it starts, and what is staying the same. People cope better when they can see the edge of the change. 'Everything is different from Monday' is not a message they can use on a shift.",
    "Tell leaders first, so they can answer questions instead of learning the news from their team. Then tell workers, then tell participants and families in plain language if the change touches their support. Pick channels that reach a dispersed workforce: a short written note they can read on a phone, plus a conversation on shift. A single email to a shared inbox is not a plan.",
  ]),
  "RR-04|Handling resistance": L([
    "Listen before you persuade. A worker who says a new manual-handling plan will not work at 6am in that bathroom may be right. Ask what they are worried about, and separate a practical concern from a refusal to change at all.",
    "When the concern is valid, change the plan. Forcing a procedure that cannot be done safely teaches people to ignore the next one. When the concern is preference rather than safety or the participant's rights, explain the reason again and hold the change. You can acknowledge that it is inconvenient and still ask them to do it.",
  ]),
  "RR-04|Participants and families": L([
    "If a change affects someone's support, they hear it in plain language, not in a staff memo. Say what will be different in their week, and what they can still decide.",
    "Consent and choice still apply. A new roster or a new way of doing personal care is not something you impose because head office decided. Talk with the person, and with the family only as the person wants. During the transition, the support itself continues. People do not lose showers, meals, or medication because the paperwork of the change is unfinished.",
  ]),
  "RR-05|Why boundaries matter": L([
    "You are in someone's home, often helping with the most private parts of their life. Warmth is part of good support. A personal, financial, or romantic relationship is not. The power sits with you: you are paid, you can leave, and you know the system. They may depend on you for care they cannot get from anyone else that day.",
    "A dual relationship is when you are also their friend, their lender, their tenant, or their partner. Dependence makes it hard for them to say no to you. What feels like closeness to you can be exploitation to them, even if they seem to agree. Boundaries protect the relationship so the support can stay safe.",
  ]),
  "RR-05|Where boundaries drift": L([
    "Drift usually starts small. A gift, a loan of twenty dollars, a lift that is not on the roster, a social media follow. Then contact outside work, private arrangements the provider does not know about, and telling the person your own problems so they end up caring for you.",
    "Physical affection and romantic or sexual interest are a hard line. A participant may want closeness. Your job is to keep the relationship as support. You do not start a relationship with someone you support, and you do not continue one. Gifts of significant value, lending money either way, and using their card are financial boundaries. If you are unsure whether something is a drift, it is already time to tell your supervisor.",
  ]),
  "RR-05|Under the Code of Conduct": L([
    "The NDIS Code of Conduct requires you to act with integrity. That means the support is for the participant, the records are true, and your private interests do not steer their choices.",
    "Sexual misconduct toward a participant is always a reportable incident. There is no version of it that stays between you. Conflicts of interest are disclosed. If your family member works for a provider you might recommend, or you would benefit from a decision, you say so before the decision is made. Hiding it is the breach, even if the decision would have been the same.",
  ]),
  "RR-05|Saying no kindly": L([
    "You can decline without shaming the person. 'I can't take the gift, and I don't need one. I like supporting you.' 'I can't lend money. Let's look at who in your plan can help with that.' Practise the sentence before you need it, so you do not laugh it off and accept.",
    "Explain the boundary as protection for them, not as a rule you are hiding behind. They should be able to trust that every worker has the same limit. Then document what was offered or asked, and tell your supervisor. A note protects both of you if the story is retold later.",
  ]),
  "RR-05|Getting help": L([
    "Notice your own warning signs. You think about one participant constantly, you share your private life with them, you resent other workers being on their shift, or you feel they are the only person who understands you. Those feelings are a signal to get supervision, not a secret to manage alone.",
    "Use supervision and reflective practice to say the uncomfortable thing early. If you see a colleague crossing a boundary — gifts, secrecy, a relationship, money — you report it. Loyalty to a workmate does not outrank the person's safety. Report through the incident pathway, factually, the same week you notice the pattern.",
  ]),
  "RR-06|Module 1: How the NDIS works": L([
    "The NDIA funds the scheme and approves plans. The NDIS Commission regulates providers and workers and handles complaints and reportable incidents. Providers, registered or not, deliver the supports. You work for a provider. You are not the NDIA, and you do not change someone's plan on the day.",
    "A plan sets the person's goals and a budget, split into support categories. You deliver what is funded and agreed, and you do not invent extra hours to fill a budget. The Practice Standards describe the support a person should receive: safe, competent, and directed by them. Registered providers work to those standards. Unregistered providers still follow the Code of Conduct.",
  ]),
  "RR-06|Module 2: Rights and person-centred practice": L([
    "The UN Convention on the Rights of Persons with Disabilities and the NDIS Act start from the same place: people with disability have the same rights as everyone else. Your shift is one of the places those rights are either real or ignored.",
    "Choice and control means the person decides what happens in their day, as far as they can, with support to understand the options. Dignity of risk means they may choose something you would not choose, and you do not take the choice away unless there is a serious risk of harm you cannot reduce another way. Privacy and consent mean you ask before you touch, before you share information, and before you invite someone else into the room.",
  ]),
  "RR-06|Module 3: Safeguarding": L([
    "Abuse and neglect have types you should be able to name: physical, sexual, emotional, financial, and neglect. You act on signs, you do not wait for proof, and you report through the provider the same shift. Restrictive practices — seclusion, chemical, mechanical, physical, and environmental restraint — are not ordinary tools. They are used only as a behaviour support plan allows.",
    "An incident is something that harmed someone or could have. Some incidents are reportable to the Commission, usually within 24 hours. You record the facts and tell your supervisor. A participant can complain about their support, including about you. You help them do it. You do not talk them out of it, and you do not retaliate.",
  ]),
  "RR-06|Module 4: Working safely": L([
    "Work health and safety applies in someone's lounge room as much as in an office. You look for hazards, you follow the safe way to move and transfer, and you stop if a task will injure you or them. Infection control is part of every shift: clean hands, cover coughs, use protective equipment for the task, and handle waste safely.",
    "Medication is done only in the way you are authorised and trained. You do not guess a dose or borrow someone else's supply. Progress notes say what support happened, how the person responded, and anything the next worker must know. If it is not written, the next person is supporting them blind.",
  ]),
  "RR-06|Module 5: Supporting behaviour": L([
    "Behaviour communicates a need: pain, fear, boredom, sensory overload, a wish to stop, or a wish for company. You look for the need before you look for a consequence. Positive behaviour support builds a life the person wants, and uses proactive strategies so restraint is needed less. The practitioner writes the plan. You implement it as written.",
    "Trauma-informed support means you expect that past harm may shape how someone reacts to touch, bathrooms, raised voices, or being told what to do. You offer predictability and choice. De-escalation is your voice, your distance, and a smaller demand. You also keep yourself safe. Leaving a room to get help is a valid response. You do not trade your safety, or theirs, to finish a task.",
  ]),
  "RR-06|Module 6: Communication and conduct": L([
    "Inclusive communication means the person gets information in a way they can use: speech, pictures, a device, Easy Read, or time to process. You wait. You do not finish their sentences and call it support. Cultural safety means you ask what matters to them — culture, faith, family, identity — and you change the support to fit, rather than asking them to fit the roster.",
    "The Code of Conduct has seven obligations. In short: respect rights, respect privacy, work safely and within your competence, be honest, raise concerns, and prevent violence, abuse, neglect, and exploitation. You stay inside your role. Warmth is part of the work. A personal, financial, or sexual relationship is not.",
  ]),
  "RR-07|Why active support": L([
    "Active support means the person takes part in their own life, at whatever level they can, instead of having life done to them. Engagement — doing, choosing, being with people — is what makes a day feel like theirs. Quality of life is that participation, not a tidy house.",
    "The hotel model is the opposite. Workers cook, clean, and decide, and the person waits. It looks efficient and it shrinks someone's skills. Research on active support shows that when staff step back to the right amount of help, people do more and spend less time disengaged. Your job is to enable, not to complete the task fastest.",
  ]),
  "RR-07|The four essentials": L([
    "Every moment has potential. Folding one towel, choosing a shirt, or stirring a pot counts. You do not wait for a program called 'activities'. Little and often beats a long session nobody can sustain. Graded assistance is the skill: ask, then instruct, then prompt, then show, then guide physically. You start with the least help that works, and you add help only for the step they cannot do yet.",
    "Choice and control run through all of it. You offer real options, not a pretend choice after you have already decided. If they pick the option that takes longer, that is the support working.",
  ]),
  "RR-07|Task analysis": L([
    "Break the task into steps small enough to see which one the person can do. Making tea might be: get the cup, put the bag in, pour the water, carry it. They may do three of those and need you for the kettle. The support is the one step, not the whole job taken over.",
    "Change the environment so the step is possible. A cup on the bench instead of in a high cupboard. A chair at the bench. Ingredients out. You are looking for the step they can own, then handing that step to them every time, so it stays theirs.",
  ]),
  "RR-07|In practice": L([
    "Use this in ordinary tasks: preparing a meal, putting on a wash, unpacking shopping, paying for a coffee. Talk through the next step and then wait. Match their pace. Filling the silence by doing it yourself is how active support disappears.",
    "If the person declines, that is a choice. You can offer again later or offer a smaller part. You do not take the task over as a punishment, and you do not insist in order to tick a goal. Record that they declined and what you offered, so the team does not read the day as 'did not engage'.",
  ]),
  "RR-07|Recording": L([
    "An engagement note says what the person did, how much help they needed, and how they seemed. A task note only says the laundry was done. The team cannot build on a task note, because it hides whether the person was part of it.",
    "Share what worked. If they did the pouring when the cup was already on the bench, write that. The next worker can set the same thing up. Active support fails when it lives in one person's head.",
  ]),
  "RR-08|Hazards": L([
    "Most slips and trips are ordinary: a wet bathroom floor, a loose rug, a cord across a walkway, clutter, a dim hallway, shoes with no grip. You notice them at the start of the shift, before you walk someone through them.",
    "Steps, kerbs, and getting in and out of a vehicle are where falls happen outside. In an office, the hazards are cables, boxes in walkways, and stairs with something in your hands. You move the hazard or you change the route. You do not step over it all shift and hope.",
  ]),
  "RR-08|Participant falls risk": L([
    "Falls risk rises with some medicines, poor vision, the wrong or missing mobility aid, rushing to the toilet, and changes in thinking or alertness. A person who has fallen before is more likely to fall again. Read that history before you work out how to support them to move.",
    "A falls risk assessment sets the plan: which aid, which route, whether someone stays beside them, what footwear. You follow it. If today they are dizzy, more tired, or without their usual glasses, you reassess in the moment and slow down. You do not stick to yesterday's plan when today is different.",
  ]),
  "RR-08|Controls": L([
    "When you arrive, look. Floors, rugs, light, the path to the bathroom, the shoes they will wear. Fix what you can safely fix: wipe the water, move the cord, turn the light on, put the frame where the plan says.",
    "Rails, non-slip mats, and the correct aid only work if they are the ones assessed for this person and they are in reach. A pretty mat that slides is a hazard. If you cannot fix a hazard — a broken step, a missing rail — report it before someone falls, and agree how you will move them safely until it is fixed.",
  ]),
  "RR-08|After a fall": L([
    "Do not lift a person who has fallen. Lifting injures your back and can worsen their injury. Look at them, talk to them, and call for help as the plan and the situation require. If they hit their head, or they take blood-thinning medicine, treat that as urgent and get medical advice even if they say they are fine.",
    "Then report the incident, including a near miss if they almost fell. Say where, what they were doing, and what the environment was like. That is how the next fall is prevented, not how blame is assigned.",
  ]),
  "RR-09|Rights and capacity": L([
    "Every adult is presumed able to make their own decisions. Disability, a guardian, or a hard decision does not cancel that presumption. You start by supporting the decision, not by taking it.",
    "Capacity is decision-specific. A person may decide what to eat and need support to decide about a medical procedure. You do not treat 'has a cognitive disability' as 'cannot decide anything'. The standard you are aiming at is their will and preferences — what they want — not what you believe is in their best interests. Best interests is the old habit of deciding for people.",
  ]),
  "RR-09|Supported versus substitute": L([
    "Supported decision-making is a range. You explain, you wait, you offer options, you involve a person they trust. Substitute decision-making is someone else deciding in their place. A guardian, an administrator, or a nominee has authority only for the decisions in their order. Read what it actually covers.",
    "A guardian for accommodation does not automatically decide dinner, clothes, or who visits. An administrator manages money, not relationships. If you are unsure, ask to see the order rather than handing the decision to a family member who sounds confident. When the person can decide, they decide, even if a guardian exists for other matters.",
  ]),
  "RR-09|Strategies": L([
    "Give information the person can use. That may be Easy Read, pictures, a short sentence, or a demonstration. Give time and repeat. Deciding in the doorway while the taxi waits is not support. Use the format they prefer, which should be in the plan.",
    "A trusted supporter helps them think. That supporter does not replace them. After the decision, record what they chose and how you know it was their choice. 'Mum said' is not the person's decision unless the order says Mum decides that matter.",
  ]),
  "RR-09|Dignity of risk": L([
    "People are allowed to make choices you disagree with: the less healthy meal, the relationship you worry about, the outing that will be tiring. You explain the risk in a way they can understand. You do not take the choice away because you would choose differently.",
    "Duty of care still applies when serious harm is likely and cannot be reduced another way. That is a high bar, not a reason to run someone's life. When you have a risk-enablement conversation, write what they understood, what they decided, and what you will do to make the choice safer. The note shows the decision was theirs.",
  ]),
  "RR-10|Models of disability": L([
    "The medical model locates the problem in the person's body or mind and tries to fix them. The charity model sees them as someone to be pitied and helped. The social model says people are disabled by barriers: stairs, attitudes, inflexible routines. The human rights model says they are rights-holders, and support exists so they can live on equal terms.",
    "Language follows the model. 'Suffering from', 'wheelchair-bound', and 'non-compliant' put the problem in the person. Talk about the person first, the support they use, and the barrier in front of them. Attitudes show up in small acts: talking to the worker instead of the person, deciding they will not want to come, calling a choice 'behaviour'.",
  ]),
  "RR-10|The rights framework": L([
    "The UN Convention sets out rights that matter on a shift: equality, accessibility, living independently, privacy, health, and being free from exploitation and abuse. You will not quote article numbers at the door. You will notice when a routine cancels one of those rights.",
    "The NDIS Act principles say people have the same rights as other Australians, and they should be able to exercise choice. The Disability Discrimination Act makes it unlawful to treat someone less favourably because of disability. A provider's convenience is not a defence.",
  ]),
  "RR-10|Rights in daily practice": L([
    "On an ordinary shift, rights look like privacy during personal care, dignity in how you speak, choice about food and clothes and visitors, taking part in household life, relationships the person wants, and sexuality that is not treated as a problem. These are not extras after the tasks. They are the support.",
    "Organisational routines override rights when everyone showers at 7 because the roster says so, or when bedrooms are locked 'for safety' without an authorisation. A restrictive practice is a rights issue first. It removes freedom. It is allowed only as a last resort, in a plan, and it should be reducing.",
  ]),
  "RR-10|When rights and rules collide": L([
    "Dignity of risk is the collision you will meet most often. The person wants to do something that carries a risk. You inform them, you reduce what you can, and you respect the choice unless serious harm cannot be prevented any other way.",
    "If a practice limits rights — a blanket rule, a locked cupboard, a decision made by staff for convenience — raise it. Tell your supervisor what you saw and whose right it affects. Advocacy services exist so the person does not have to argue alone. Help them contact one if they want that. Do not talk them out of it.",
  ]),
  "RR-11|Understanding trauma": L([
    "Trauma is the lasting effect of an event or a life that overwhelmed a person's ability to cope. A single incident is one event. Complex trauma is repeated harm, often in relationships. Developmental trauma happens in childhood, while the brain and the sense of safety are still forming. Many people with disability have lived with one or more of these, including in institutions and out-of-home care.",
    "Trauma changes the brain and body. Alarm systems stay on. Touch, a closed door, a raised voice, or a loss of control can feel like the original harm, even when this shift is kind. You are not treating trauma. You are supporting in a way that does not set that alarm off.",
  ]),
  "RR-11|Recognising responses": L([
    "Fight, flight, freeze, and fawn are survival responses, not attitudes. Fight can look like shouting or hitting. Flight can look like leaving or refusing to enter a room. Freeze can look like silence and stillness that gets called 'non-compliance'. Fawn can look like agreeing to everything, including things they do not want, because agreement used to keep them safe.",
    "Common triggers in care are touch, bathrooms, being naked, raised voices, being rushed, and being told what to do with no choice. The behaviour is communication. Ask what just happened, reduce the demand, and follow the plan. Do not punish a survival response.",
  ]),
  "RR-11|Principles in practice": L([
    "Predictability and choice lower the alarm. Say what will happen next, and offer a real choice about order, clothing, or who is in the room. Ask before you touch, every time, including people you have supported for years. Consent is not a one-off signature.",
    "Build routines with the person, not for them. A routine they helped design is safer than one imposed 'because it works'. Cultural safety matters here too. What feels respectful in one community can feel exposing in another. Ask, and follow what they and their people tell you.",
  ]),
  "RR-11|Avoiding re-traumatisation": L([
    "Restrictive practices replay the experience of being overpowered. Use them only as an authorised last resort, and treat every use as a serious event, not a technique. Language of power and control — 'you have to', 'because I said', 'don't make me' — tells the body it is not safe.",
    "After a difficult moment, repair. Come back calm, say what happened in simple words, and restore choice. Do not pretend it did not happen, and do not lecture. A short, respectful return teaches that the relationship survived.",
  ]),
  "RR-11|Worker wellbeing": L([
    "Vicarious trauma is the effect on you of hearing and seeing other people's harm, over and over. It can make you numb, cynical, or constantly on edge. That changes the support. A numb worker misses signs. An on-edge worker escalates situations.",
    "Use supervision and debrief to put the shift down, not to gossip about the person. Keep boundaries so their trauma does not become your private relationship with them. If you are not sleeping, or you dread a particular shift, tell your team leader before it becomes the way you work.",
  ]),
  "RR-12|Who the Code covers": L([
    "The NDIS Code of Conduct applies to registered and unregistered providers, and to every worker: support workers, team leaders, contractors, and office staff. Registration is not the thing that creates the duty.",
    "Office staff are covered because they handle money, rosters, records, and complaints. A rostering decision or a privacy breach in the office can harm a participant as surely as a bad shift. If your work touches a participant's life, the Code applies to you.",
  ]),
  "RR-12|The seven elements": L([
    "Act with respect for individual rights, including choice and dignity of risk. Respect privacy. Provide supports safely and competently, which means you do not do tasks you are not trained and authorised to do. Act with integrity, honesty, and transparency, including about conflicts of interest.",
    "Promptly raise and act on concerns about quality and safety. Do not wait to see if someone else notices. Take all reasonable steps to prevent and respond to violence, exploitation, neglect, and abuse. 'I didn't want to dob' is not one of the elements. There is a seventh obligation in the Code's guidance about not engaging in sexual misconduct. Sexual contact with a participant is never part of the job.",
  ]),
  "RR-12|Elements in practice": L([
    "Each obligation shows up differently by role. A support worker respects rights by offering a real choice at breakfast. An admin worker respects rights by not deciding a service is 'too hard' without talking to the person. A leader respects rights by refusing a house rule that locks everyone's food away.",
    "Privacy is a closed bathroom door, and it is also not leaving a participant's plan open on a reception desk. Competence is refusing a hoist you have not been shown. Integrity is writing the note for the shift you actually worked. Raising a concern is telling someone the same day that a participant flinched when a colleague came in. Preventing abuse is interrupting mockery, not laughing along.",
  ]),
  "RR-12|Enforcement": L([
    "A participant, a worker, or a member of the public can complain to the NDIS Commission. The Commission can investigate, require a provider to change, and ban a worker.",
    "A banning order stops a person working in the sector, and banned workers are listed on a register providers must check. Consequences land on workers and on providers. 'I was following the house' does not remove your own obligation under the Code.",
  ]),
  "RR-12|Raising concerns": L([
    "Use the internal pathway first when it is safe: your supervisor, or the next person up if your supervisor is the problem. Say what you saw, who was there, and what you have already done.",
    "You can complain directly to the Commission, especially if the internal path is the risk. You are protected from reprisal for raising a concern in good faith. If your shifts are cut, you are frozen out, or you are told to stop making trouble after you reported, that is a further concern and you report that too.",
  ]),
  "RR-13|What information is protected": L([
    "Personal information identifies someone: name, address, photo, date of birth. Sensitive information includes health, disability, and sexuality. Health information is the plans, diagnoses, medication, and notes you write. All of it is protected. Curiosity is not a reason to open a file.",
    "The Australian Privacy Principles, in plain terms, mean you collect only what you need, you use it for the reason it was given, you keep it accurate, you store it safely, and the person can ask to see it. Participant records, photos, plans, and progress notes are all in scope. A photo on your phone is a record, not a souvenir.",
  ]),
  "RR-13|Consent and sharing": L([
    "Informed consent means the person understands what will be shared, with whom, and why, and they agree. If a guardian has authority for that decision, the guardian can consent within the order. A family member who is not the guardian does not automatically get the file.",
    "Sharing with family, another provider, or the NDIA needs a reason and consent, unless a law requires the disclosure, such as a serious safety report. Inside your organisation, need-to-know means the next worker on the shift hears what they need to support the person. The whole group chat does not.",
  ]),
  "RR-13|Privacy and dignity in practice": L([
    "During personal care, shut the door, close the curtain, cover the person, and ask before you start. Talk to them, not about them, while you work. Other people in the house do not get a commentary.",
    "Do not discuss a participant in a cafe, in a shop queue, or in the car where other passengers can hear the details. Photos and social media are out unless there is specific consent for that photo and that use. A face in the background of your story is still their face.",
  ]),
  "RR-13|Storing and sending": L([
    "Lock your screen. Use the passwords you were given. Do not leave a roster or a plan open on a kitchen bench or a car seat. Work devices stay with you.",
    "Check the recipient before you send an email or a message. Autocomplete sends files to the wrong person every week. Paper records do not live in your car overnight or in a participant's spare room 'for convenience'. They go back to the place your provider keeps them.",
  ]),
  "RR-13|Data breaches": L([
    "A breach is when personal information is lost, accessed, or sent where it should not be. A stolen laptop, a photo in the wrong chat, a bag left on the bus, an email to the wrong family. If you are not sure, treat it as a breach.",
    "Contain it immediately. Recall the message if you can, lock the device, tell the people who received it not to forward it. Then report internally straight away so the provider can judge whether it is a notifiable breach. Do not wait to see if anyone complains, and do not delete the evidence to make the problem smaller.",
  ]),
  "RR-14|Cultural safety": L([
    "Cultural awareness is knowing differences exist. Sensitivity is not offending on purpose. Competence is having some skills. Safety is decided by the person receiving the support, not by you. If they do not feel safe to be themselves with you, the support is not culturally safe, however polite you were.",
    "Unconscious bias is the assumption you do not notice: who you explain things to, whose family you trust, whose pain you take seriously. Slow down when you notice you have decided what someone will want before you asked.",
  ]),
  "RR-14|Aboriginal and Torres Strait Islander participants": L([
    "History matters. Removal, institutions, and racism in health and disability systems are why trust is not automatic. You earn it by listening, by not rushing, and by not requiring someone to tell their story to get basic respect.",
    "Family, community, and Country shape decisions. The right person to involve may not be the person on the intake form. Work with Aboriginal Community Controlled organisations when the person wants that. Do not position yourself as the expert on their culture.",
  ]),
  "RR-14|CALD communities": L([
    "Use a qualified interpreter when the person wants one or when the decision needs it. Do not use a child, or a worker who 'knows a bit of the language', for a consent or a health conversation. Family roles differ. Ask who the person wants involved, rather than assuming an elder or a spouse decides.",
    "Faith shows up in food, prayer times, modesty, and who may provide personal care. Build the shift around those practices. Disability is understood differently across cultures. Your job is to hear this family's meaning, not to correct it.",
  ]),
  "RR-14|LGBTIQA+ participants": L([
    "Use the name and pronouns the person uses. If records have an old name, raise the correction. Do not 'compromise' with a name they have left. Disclosure is theirs. You do not tell family, other workers, or a new house that someone is gay, trans, or intersex unless they have asked you to.",
    "Personal care is planned so they are safe. That includes who provides it, how their body is spoken about, and privacy from other residents. Jokes, religious lectures, and 'I don't believe in that' are not support. They are discrimination.",
  ]),
  "RR-14|Building it into the service": L([
    "Ask about culture, faith, language, family, and identity at intake, and ask again later. People do not owe you their whole story on day one. Write the preferences that change the support: food, prayer, who visits, who provides personal care, which days matter.",
    "If a practice is culturally unsafe — a worker refusing to use a pronoun, a house rule that mocks food or prayer, a roster that ignores a request for a worker of a particular gender for personal care — raise it. The person should not have to absorb it to keep the peace.",
  ]),
}

function writeCatalogue(items) {
  const byCode = new Map(items.map((item) => [item.code, item]))
  let missing = 0
  for (const course of items) {
    if (descriptions[course.code]) course.description = descriptions[course.code]
    if (course.kind !== "course") continue
    for (const step of course.lesson.steps) {
      if (step.kind === "learn") {
        if (!LESSONS[`${course.code}|${step.title}`]) {
          missing += 1
          continue
        }
        step.paragraphs = paragraphsFor(course, step)
        step.kicker = "Education"
      }
      if (step.kind === "exam") step.intro = teachIntro(step.intro, "course")
    }
  }
  if (missing) {
    const names = []
    for (const course of items) {
      if (course.kind !== "course") continue
      for (const step of course.lesson.steps) {
        if (step.kind === "learn" && !LESSONS[`${course.code}|${step.title}`]) {
          names.push(`${course.code}|${step.title}`)
        }
      }
    }
    console.error(`Missing ${missing} lessons`)
    console.error(names.join("\n"))
    process.exitCode = 2
    return
  }

  for (const item of items) {
    if (item.kind === "bite") {
      const learn = item.lesson.steps.find((step) => step.kind === "learn")
      learn.paragraphs = teachBite(item, byCode)
      learn.kicker = "Education"
    }
    if (item.kind === "checkpoint") {
      const learn = item.lesson.steps.find((step) => step.kind === "learn")
      learn.paragraphs = teachCheckpoint(item, byCode)
      learn.kicker = "Education"
      learn.points = parentCourses(item, byCode).map((parent) => parent.title)
      const exam = item.lesson.steps.find((step) => step.kind === "exam")
      if (exam) exam.intro = teachIntro(exam.intro, "checkpoint")
    }
    if (item.kind === "hub") {
      item.lesson.steps = teachHub(item, byCode)
    }
  }

  const taught = items.flatMap((item) =>
    item.lesson.steps
      .filter((step) => step.kind === "learn")
      .flatMap((step) => step.paragraphs)
  )
  const blob = taught.join("\n")
  if (AUDIT.test(blob)) {
    const hit = blob.match(AUDIT)
    console.error("Audit-framed wording remains:", hit?.[0])
    process.exitCode = 3
    return
  }
  writeFileSync(path, JSON.stringify(items))
  const courses = items.filter((item) => item.kind === "course").length
  console.log(`Rewrote education for ${courses} courses`)
}

Object.assign(LESSONS, rest, restMore)
writeCatalogue(catalogue)
