import type { LessonContent } from "@/modules/training/lesson"

export const infectionControlLesson: LessonContent = {
  version: 1,
  steps: [
    {
      id: "why",
      kind: "learn",
      kicker: "Education",
      title: "Why infection control is part of every shift",
      paragraphs: [
        "NDIS Practice Standards require every worker who supports participants to be trained in infection prevention and control, including refreshers. Direct support workers also need training in personal protective equipment (PPE).",
        "Standard precautions apply in every setting: a participant’s home, a vehicle, a community outing, and a centre. You use them with every person, whether or not an infection has been diagnosed.",
      ],
      points: [
        "Hand hygiene, respiratory hygiene, and cough etiquette",
        "PPE when the support requires it",
        "Safe handling of waste, body fluids, and used PPE",
        "Cleaning of frequently touched surfaces outside a participant’s home",
      ],
      image: {
        src: "/training/infection-control/standard-precautions.svg",
        alt: "Four standard precautions: clean hands, cover coughs, wear PPE, and handle waste safely.",
      },
    },
    {
      id: "hands",
      kind: "learn",
      kicker: "Education",
      title: "Hand hygiene",
      paragraphs: [
        "Clean hands are the first line of defence. Use alcohol-based hand rub when hands are not visibly dirty. Wash with soap and water when hands are visibly soiled, after the toilet, and after contact with body fluids.",
        "Clean your hands at the moments that protect the participant and you: before touching them, before a clean or aseptic task, after body-fluid exposure, after touching them, and after touching their surroundings.",
      ],
      points: [
        "Rub all surfaces for about 20 seconds, including thumbs and fingertips",
        "Dry with a clean towel after washing",
        "Keep nails short and skip rings that trap moisture",
      ],
      image: {
        src: "/training/infection-control/hand-hygiene.svg",
        alt: "Hands being cleaned at five moments: before touch, before a clean task, after body fluids, after touch, and after surroundings.",
      },
      photos: [
        {
          src: "/training/infection-control/hand-wash.jpg",
          alt: "Hands being washed with soap under running water at a sink.",
        },
        {
          src: "/training/infection-control/hand-rub.jpg",
          alt: "Alcohol-based hand rub being dispensed into an open palm.",
        },
      ],
    },
    {
      id: "check-hands",
      kind: "check",
      kicker: "Check your learning",
      title: "When soap and water is the right choice",
      prompt: "A participant’s hands, and yours, are visibly soiled after personal care. What should you do?",
      options: [
        { id: "a", label: "Use alcohol-based hand rub only, because it is faster" },
        { id: "b", label: "Wash with soap and water" },
        { id: "c", label: "Put gloves on and skip cleaning until the end of the shift" },
      ],
      correct_option_id: "b",
      feedback:
        "Visibly soiled hands need soap and water. Alcohol rub is for hands that are not visibly dirty. Gloves never replace hand hygiene.",
      image: {
        src: "/training/infection-control/hand-wash.jpg",
        alt: "Hands being washed with soap under running water at a sink.",
      },
    },
    {
      id: "respiratory",
      kind: "learn",
      kicker: "Education",
      title: "Respiratory hygiene and cough etiquette",
      paragraphs: [
        "Cover coughs and sneezes with a tissue or the inside of your elbow, then clean your hands. Offer the same support to the participant: tissues within reach, a bin for used tissues, and help to clean their hands if they want it.",
        "Stay home if you have symptoms that could spread, such as fever, a new cough, vomiting, or diarrhoea, and tell your supervisor. Do not decide on your own that a participant’s symptoms are ‘just a cold’.",
      ],
      image: {
        src: "/training/infection-control/cough-etiquette.svg",
        alt: "A person covering a cough with their elbow, with a tissue and a bin nearby.",
      },
      photos: [
        {
          src: "/training/infection-control/cough-elbow.jpg",
          alt: "A person covering a cough with the inside of their elbow.",
        },
        {
          src: "/training/infection-control/tissues.jpg",
          alt: "A box of tissues left within reach.",
        },
      ],
    },
    {
      id: "ppe",
      kind: "learn",
      kicker: "Education",
      title: "Personal protective equipment",
      paragraphs: [
        "PPE is for the task, not for every minute of a shift. Gloves, aprons or gowns, masks, and eye protection are used when there is a risk of contact with blood, body fluids, or respiratory droplets, and when the support plan or your organisation’s procedure says so.",
        "Put PPE on before the exposure risk starts. Take it off carefully so the outside does not touch your skin or clothes, then clean your hands. Never reuse disposable gloves or walk between rooms in the same pair.",
      ],
      points: [
        "PPE must be available to each worker and participant who needs it",
        "Change gloves between tasks and between participants",
        "A mask covers nose and mouth and is replaced when damp",
      ],
      image: {
        src: "/training/infection-control/ppe.svg",
        alt: "Gloves, apron, mask, and eye protection laid out in the order they are put on.",
      },
      photos: [
        {
          src: "/training/infection-control/gloves.jpg",
          alt: "A person putting on a clean disposable glove.",
        },
        {
          src: "/training/infection-control/masks.jpg",
          alt: "Surgical masks with the outside of the mask marked.",
        },
      ],
    },
    {
      id: "check-ppe",
      kind: "check",
      kicker: "Check your learning",
      title: "Gloves between tasks",
      prompt: "You finish helping one participant with personal care and walk next door to support someone else. What happens to the gloves?",
      options: [
        { id: "a", label: "Keep them on so you stay protected for the next person" },
        { id: "b", label: "Remove them, clean your hands, and put on a new pair if the next task needs gloves" },
        { id: "c", label: "Wipe the outside of the gloves with a tissue and continue" },
      ],
      correct_option_id: "b",
      feedback:
        "Gloves are single-use for a task and a person. Remove them, perform hand hygiene, and put on new gloves only if the next task needs them.",
      image: {
        src: "/training/infection-control/gloves.jpg",
        alt: "A person putting on a clean disposable glove.",
      },
    },
    {
      id: "waste",
      kind: "learn",
      kicker: "Education",
      title: "Waste, spills, and the space around you",
      paragraphs: [
        "Used PPE, continence products, and materials soiled with body fluids go into the waste stream your organisation specifies. Do not leave used gloves on a bench, in a vehicle, or in a participant’s kitchen bin if a clinical or contaminated-waste bin is required.",
        "Clean spills of blood or body fluid promptly, wearing the PPE the procedure calls for. In settings that are not the participant’s home, routinely clean frequently touched surfaces such as door handles, switches, and shared equipment.",
      ],
      image: {
        src: "/training/infection-control/waste.svg",
        alt: "Used gloves and a continence product placed in a lined waste bin, with clean hands afterwards.",
      },
      photos: [
        {
          src: "/training/infection-control/vehicle-clean.jpg",
          alt: "A gloved hand cleaning inside a vehicle with a spray bottle.",
        },
      ],
    },
    {
      id: "check-waste",
      kind: "check",
      kicker: "Check your learning",
      title: "A spill during a shift",
      prompt: "You find a small blood spill on a bathroom floor in a centre. What is the safe order of work?",
      options: [
        { id: "a", label: "Wipe it with the nearest hand towel, then wash your hands" },
        { id: "b", label: "Put on the required PPE, clean the spill using the organisation’s procedure, dispose of waste, then clean your hands" },
        { id: "c", label: "Leave it for the cleaner and continue the support" },
      ],
      correct_option_id: "b",
      feedback:
        "Blood and body-fluid spills are cleaned straight away, with the PPE and method in your procedure. Waste is disposed of safely, and hand hygiene finishes the task.",
    },
    {
      id: "exam",
      kind: "exam",
      kicker: "Final exam",
      title: "Infection prevention and control",
      intro:
        "Answer every question. You need 80% to pass. If you do not reach the pass mark, you can review the questions and try again. Your score is saved for your manager.",
      questions: [
        {
          id: "q1",
          prompt: "Standard precautions apply:",
          options: [
            { id: "a", label: "Only when a participant has a diagnosed infection" },
            { id: "b", label: "In every setting, with every participant" },
            { id: "c", label: "Only inside a centre or clinic" },
          ],
          correct_option_id: "b",
        },
        {
          id: "q2",
          prompt: "Alcohol-based hand rub is appropriate when:",
          options: [
            { id: "a", label: "Hands are not visibly dirty" },
            { id: "b", label: "Hands are visibly soiled with body fluid" },
            { id: "c", label: "You are wearing gloves" },
          ],
          correct_option_id: "a",
        },
        {
          id: "q3",
          prompt: "Which moment is a required time to clean your hands?",
          options: [
            { id: "a", label: "Only at the start and end of the shift" },
            { id: "b", label: "Before touching a participant and after contact with body fluids" },
            { id: "c", label: "Only if the participant asks you to" },
          ],
          correct_option_id: "b",
        },
        {
          id: "q4",
          prompt: "The recommended way to cover a cough when you have no tissue is:",
          options: [
            { id: "a", label: "Your open palm, then keep working" },
            { id: "b", label: "The inside of your elbow, then clean your hands" },
            { id: "c", label: "Turn your face toward the participant so the cough is contained" },
          ],
          correct_option_id: "b",
        },
        {
          id: "q5",
          prompt: "You have a new cough and a fever on the morning of a shift. You should:",
          options: [
            { id: "a", label: "Attend the shift and wear a mask so the roster is covered" },
            { id: "b", label: "Stay home and tell your supervisor" },
            { id: "c", label: "Attend, but avoid close personal care" },
          ],
          correct_option_id: "b",
        },
        {
          id: "q6",
          prompt: "Disposable gloves should be:",
          options: [
            { id: "a", label: "Washed and reused if they look clean" },
            { id: "b", label: "Removed between participants and between tasks, followed by hand hygiene" },
            { id: "c", label: "Left on while you prepare food in the kitchen" },
          ],
          correct_option_id: "b",
        },
        {
          id: "q7",
          prompt: "PPE is required for direct support workers because:",
          options: [
            { id: "a", label: "The NDIS Practice Standards require training and refreshers in PPE use, and PPE available when it is needed" },
            { id: "b", label: "Gloves replace the need for hand hygiene" },
            { id: "c", label: "A mask must be worn for the entire shift in every home" },
          ],
          correct_option_id: "a",
        },
        {
          id: "q8",
          prompt: "Used PPE and materials soiled with body fluids should be:",
          options: [
            { id: "a", label: "Left on a bench until the end of the shift" },
            { id: "b", label: "Disposed of in the waste stream your organisation specifies" },
            { id: "c", label: "Rinsed in the participant’s kitchen sink" },
          ],
          correct_option_id: "b",
        },
      ],
    },
  ],
}
