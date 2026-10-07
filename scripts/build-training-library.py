#!/usr/bin/env python3
"""Build the NDIS training catalogue as lesson JSON for the existing player."""

import json
import re
from pathlib import Path
from typing import Optional

SOURCE = Path("/tmp/ndis-courses.txt")
OUT = Path("/Users/izakreeves/kinsa-saas1/kinsa-saas/modules/training/library/catalogue.json")

FAMILIES = {
    "RR": "Rights and responsibilities",
    "GO": "Governance and operations",
    "PS": "Provision of supports",
    "SE": "Support environment",
    "AS": "All staff",
    "CC": "Complex care",
    "ST": "Condition-specific",
    "B": "Bites",
    "CP": "Checkpoints",
    "H": "Resource hubs",
}

COVERS = {
    "RR": "/training/library/rights.svg",
    "GO": "/training/library/governance.svg",
    "PS": "/training/library/supports.svg",
    "SE": "/training/library/environment.svg",
    "AS": "/training/library/office.svg",
    "CC": "/training/library/complex-care.svg",
    "ST": "/training/library/conditions.svg",
    "B": "/training/library/bites.svg",
    "CP": "/training/library/checkpoints.svg",
    "H": "/training/library/hubs.svg",
}


def clean(text: str) -> str:
    text = re.sub(
        r"NDIS staff compliance training library: course specifications\s+\d+\s*",
        "\n",
        text,
    )
    text = text.replace("\u007f", "-").replace("•", "-")
    return text


def months_from(refresher: str) -> Optional[int]:
    if re.search(r"once|no expiry", refresher, re.I):
        return None
    match = re.search(r"(\d+)\s*months", refresher, re.I)
    return int(match.group(1)) if match else None


def is_required(status: str) -> bool:
    return bool(re.search(r"expected|explicitly|mandated|required", status, re.I))


def family_of(code: str) -> str:
    return code.split("-")[0]


def sentence(bullet: str) -> str:
    text = bullet.strip().rstrip(".")
    if not text:
        return ""
    return text[0].upper() + text[1:] + "."


def paragraphs_for(title: str, bullets: list[str], purpose: str) -> list[str]:
    joined = " ".join(sentence(item) for item in bullets[:5])
    lead = purpose.strip()
    if lead and not lead.endswith("."):
        lead += "."
    second = (
        f"{joined} "
        "Your provider's policy for this topic sets the local steps. Use it with what you learn here."
    )
    if "state" in joined.lower() or "child" in title.lower():
        second += " Where state or territory law differs, follow your provider's state-specific policy."
    return [lead or second, second if lead else joined]


def option_set(correct: str, wrongs: list[str]) -> tuple[list[dict], str]:
    labels = [correct, *wrongs[:2]]
    options = [{"id": "abc"[index], "label": label} for index, label in enumerate(labels)]
    return options, "a"


def check(step_id: str, title: str, prompt: str, correct: str, wrongs: list[str], feedback: str) -> dict:
    options, correct_id = option_set(correct, wrongs)
    return {
        "id": step_id,
        "kind": "check",
        "kicker": "Check your learning",
        "title": title,
        "prompt": prompt,
        "options": options,
        "correct_option_id": correct_id,
        "feedback": feedback,
        "image": {"src": "/training/library/check.svg", "alt": "A short check on the lesson you just finished."},
    }


def learn(step_id: str, title: str, paragraphs: list[str], points: list[str], cover: str) -> dict:
    return {
        "id": step_id,
        "kind": "learn",
        "kicker": "Education",
        "title": title,
        "paragraphs": paragraphs,
        "points": points[:6],
        "image": {"src": cover, "alt": title},
    }


def exam(title: str, questions: list[dict], pass_note: str) -> dict:
    return {
        "id": "exam",
        "kind": "exam",
        "kicker": "Final exam",
        "title": title,
        "intro": pass_note,
        "questions": questions,
    }


def question(qid: str, prompt: str, correct: str, wrongs: list[str]) -> dict:
    options, correct_id = option_set(correct, wrongs)
    return {"id": qid, "prompt": prompt, "options": options, "correct_option_id": correct_id}


UNSAFE = [
    "Ignore it and finish the shift without telling anyone",
    "Decide on your own that it is not important enough to record",
    "Ask the participant to keep it secret",
]


def lesson_checks(code: str, index: int, title: str, bullets: list[str]) -> list[dict]:
    points = bullets or [title]
    first = sentence(points[0]).rstrip(".")
    second = sentence(points[1]).rstrip(".") if len(points) > 1 else first
    third = sentence(points[2]).rstrip(".") if len(points) > 2 else second
    return [
        check(
            f"{code.lower()}-l{index}-c1",
            title,
            f"Which practice belongs in “{title}”?",
            first,
            UNSAFE[:2],
            f"{first}. That is the practice this lesson expects. The other options leave the participant or the record unprotected.",
        ),
        check(
            f"{code.lower()}-l{index}-c2",
            title,
            f"A colleague says you can skip this: “{second}”. What do you do?",
            f"Follow it: {second[0].lower() + second[1:]}",
            [
                "Skip it if the shift is busy",
                "Do the opposite so you save time",
            ],
            f"Follow the practice: {second}. Busy shifts are when these steps matter most.",
        ),
        check(
            f"{code.lower()}-l{index}-c3",
            title,
            "What should you do before you move on from this situation?",
            third if third != first else "Record what happened and follow your provider's policy",
            [
                "Wait to see if someone else reports it",
                "Only mention it if a manager asks",
            ],
            "Act on the point you just learned, then record it in the way your provider's policy describes.",
        ),
    ]


def scenario_checks(code: str, scenario: str) -> list[dict]:
    if not scenario or re.search(r"not required", scenario, re.I):
        return []
    steps = re.findall(
        r"Step\s+(\d+):\s*(.*?)(?=Step\s+\d+:|$)",
        scenario,
        flags=re.S,
    )
    checks = []
    if not steps:
        steps = [("1", scenario[:400])]
    for number, body in steps[:4]:
        body = re.sub(r"\s+", " ", body).strip()
        critical = ""
        match = re.search(r"\(critical:\s*(.*?)\)", body, re.I)
        if match:
            critical = match.group(1).strip().rstrip(".")
            body = re.sub(r"\(critical:.*?\)", "", body, flags=re.I).strip()
        correct = critical or "Do the safe next step, then record and tell your supervisor"
        checks.append(
            check(
                f"{code.lower()}-s{number}",
                f"Scenario, step {number}",
                body[:280] if body else f"What do you do at step {number}?",
                correct[0].upper() + correct[1:] if correct else correct,
                UNSAFE[:2],
                f"{correct[0].upper() + correct[1:]}. A wrong choice here puts the participant at risk or hides the record.",
            )
        )
    return checks


def exam_questions(code: str, title: str, lessons: list[dict], count: int) -> list[dict]:
    pool = []
    for lesson in lessons:
        for bullet in lesson["bullets"]:
            pool.append((lesson["title"], sentence(bullet).rstrip(".")))
    if not pool:
        pool = [(title, title)]
    questions = []
    index = 0
    while len(questions) < count:
        lesson_title, point = pool[index % len(pool)]
        variant = len(questions) // len(pool)
        if variant == 0:
            prompt = f"Which statement is the correct practice for {lesson_title.lower()}?"
            correct = point
        elif variant == 1:
            prompt = f"You are unsure during a shift about {lesson_title.lower()}. What is the right action?"
            correct = point
        else:
            prompt = f"In {title}, which of these meets the standard for {lesson_title.lower()}?"
            correct = point
        questions.append(
            question(
                f"{code.lower()}-q{len(questions) + 1}",
                prompt,
                correct,
                UNSAFE[:2],
            )
        )
        index += 1
        if index > count * 3:
            break
    return questions[:count]


def parse_courses(text: str) -> list[dict]:
    start = text.rfind("Part D1:")
    end = text.rfind("Part E: Bites")
    body = text[start:end]
    pattern = re.compile(r"^(RR|GO|PS|SE|AS|CC|ST)-\d{2}\s+", re.M)
    matches = list(pattern.finditer(body))
    courses = []
    for index, match in enumerate(matches):
        chunk = body[match.start() : matches[index + 1].start() if index + 1 < len(matches) else len(body)]
        courses.append(parse_course(chunk))
    return [course for course in courses if course]


def field(chunk: str, label: str, next_labels: list[str]) -> str:
    pattern = re.compile(
        rf"{label}\s*(.*?)(?={'|'.join(next_labels)}|\Z)",
        re.S,
    )
    found = pattern.search(chunk)
    if not found:
        return ""
    return re.sub(r"\s+", " ", found.group(1)).strip(" -\n")


def parse_course(chunk: str) -> Optional[dict]:
    lines = [line.strip() for line in chunk.splitlines() if line.strip()]
    code_match = re.match(r"^((?:RR|GO|PS|SE|AS|CC|ST)-\d{2})\s+(.*)$", lines[0])
    if not code_match:
        return None
    code = code_match.group(1)
    title_lines = [code_match.group(2)]
    for line in lines[1:]:
        if "Audience:" in line or line.startswith("Standards") or "|" in line:
            break
        title_lines.append(line)
    title = re.sub(r"\s+", " ", " ".join(title_lines)).strip()
    meta = re.search(r"Audience:\s*(.*?)\s*\|\s*Duration:", chunk)
    audience = meta.group(1).strip() if meta else "All staff"
    standards = field(chunk, "Standards mapping", ["Requirement status"])
    status = field(chunk, "Requirement status", ["Delivery"])
    delivery = field(chunk, "Delivery", ["Refresher"])
    refresher = field(chunk, "Refresher", ["Purpose"])
    purpose = field(chunk, "Purpose", ["Learning outcomes"])
    content_match = re.search(r"Course content\s*(.*?)(?=Check your learning)", chunk, re.S)
    content = content_match.group(1) if content_match else ""
    scenario = field(chunk, "Scenario test", ["Final exam"])
    exam_text = field(chunk, "Final exam", ["RR-", "GO-", "PS-", "SE-", "AS-", "CC-", "ST-", "Part "])
    exam_count = 10
    count_match = re.search(r"(\d+)\s+questions", exam_text)
    if count_match:
        exam_count = int(count_match.group(1))
    lessons = []
    lesson_parts = re.split(r"Lesson\s+\d+:\s*", content)
    for part in lesson_parts[1:]:
        lines = [line.strip(" -") for line in part.split("\n") if line.strip()]
        if not lines:
            continue
        lesson_title = re.sub(r"\s+", " ", lines[0]).strip()
        bullets = []
        for line in lines[1:]:
            cleaned = re.sub(r"\s+", " ", line).strip(" -")
            if cleaned and not cleaned.lower().startswith("lesson"):
                bullets.append(cleaned)
        if lesson_title:
            lessons.append({"title": lesson_title, "bullets": bullets})
    return {
        "code": code,
        "title": title,
        "audience": audience,
        "standards": standards,
        "requirement_status": status,
        "delivery": delivery,
        "refresher": refresher,
        "purpose": purpose,
        "scenario": scenario,
        "exam_count": exam_count,
        "lessons": lessons,
    }


def build_lesson(course: dict) -> dict:
    cover = COVERS[family_of(course["code"])]
    steps = []
    for index, lesson in enumerate(course["lessons"], start=1):
        steps.append(
            learn(
                f"{course['code'].lower()}-l{index}",
                lesson["title"],
                paragraphs_for(lesson["title"], lesson["bullets"], course["purpose"] if index == 1 else ""),
                lesson["bullets"],
                cover,
            )
        )
        steps.extend(lesson_checks(course["code"], index, lesson["title"], lesson["bullets"]))
    steps.extend(scenario_checks(course["code"], course["scenario"]))
    theory = "theory only" in course["delivery"].lower() or "practical" in course["delivery"].lower()
    intro = "Answer every question. You need 80% to pass. Your score is saved on your worker record."
    if theory and course["code"].startswith("CC"):
        intro += " This certificate is the theory component. A qualified health practitioner must still sign off your practical competency before you deliver this support."
    steps.append(exam(course["title"], exam_questions(course["code"], course["title"], course["lessons"], course["exam_count"]), intro))
    return {"version": 1, "steps": steps}


def build_bites(text: str) -> list[dict]:
    start = text.rfind("Part E: Bites")
    end = text.rfind("Part F:")
    body = text[start:end]
    rows = re.split(r"\n(?=B-\d{2}\n)", body)
    bites = []
    for row in rows:
        match = re.match(r"B-(\d{2})\n(.*?)\n((?:RR|GO|PS|SE|AS|CC|ST)-\d{2})", row, re.S)
        if not match:
            continue
        code = f"B-{match.group(1)}"
        title = re.sub(r"\s+", " ", match.group(2)).strip()
        parent = match.group(3)
        rest = row.split(parent, 1)[1]
        parts = [re.sub(r"\s+", " ", part).strip() for part in rest.split("\n\n") if part.strip()]
        content = parts[0] if parts else title
        prompts = parts[1] if len(parts) > 1 else ""
        questions = [item.strip() for item in re.split(r";", prompts) if item.strip()]
        bites.append({"code": code, "title": title, "parent": parent, "content": content, "questions": questions[:3]})
    return bites


def build_bite_lesson(bite: dict) -> dict:
    cover = COVERS["B"]
    points = [item.strip() for item in re.split(r",| and ", bite["content"]) if len(item.strip()) > 8][:4]
    if not points:
        points = [bite["content"]]
    steps = [
        learn(
            f"{bite['code'].lower()}-learn",
            bite["title"],
            [
                f"This five-minute refresher is a short recap of {bite['parent']}. {bite['content']}",
                "It does not replace the full course unless your provider has agreed to accept the Bite as the refresher. Read the provider policy for this topic as well.",
            ],
            points,
            cover,
        )
    ]
    prompts = bite["questions"] or points
    while len(prompts) < 3:
        prompts.append(points[len(prompts) % len(points)])
    for index, prompt in enumerate(prompts[:3], start=1):
        correct = sentence(points[(index - 1) % len(points)]).rstrip(".")
        steps.append(
            check(
                f"{bite['code'].lower()}-c{index}",
                bite["title"],
                prompt.rstrip(".") + "?",
                correct,
                UNSAFE[:2],
                f"{correct}. Use the same practice as the full {bite['parent']} course.",
            )
        )
    return {"version": 1, "steps": steps}


CHECKPOINTS = [
    ("CP-01", "Incident Reporting Checkpoint", ["GO-07"], "Draws on reportable incidents and recording. A fail sends the worker back to Handling Incidents."),
    ("CP-02", "Infection Prevention and Control Checkpoint", ["SE-05", "SE-13", "SE-15", "SE-02"], "Includes hand hygiene, PPE and respiratory hygiene. This is the refresher the Practice Standards name. A fail sends the worker back to Infection Prevention and Control."),
    ("CP-03", "Managing Waste Checkpoint", ["SE-12"], "A fail sends the worker back to Management of Waste."),
    ("CP-04", "Manual Handling Checkpoint", ["SE-06", "SE-07", "SE-08", "SE-09", "SE-10"], "Two items from each manual handling course. This does not replace practical observation."),
    ("CP-05", "Medication Management Checkpoint", ["SE-11"], "Includes an error scenario and a refusal scenario. This does not replace the annual competency observation."),
    ("CP-06", "Positive Behaviour Support Checkpoint", ["PS-03", "PS-01"], "Includes each of the five regulated restrictive practices. A fail sends the worker back to Understanding Restrictive Practices, then Positive Behaviour Support."),
    ("CP-07", "Code of Conduct Checkpoint", ["RR-12"], "One item for each Code obligation, plus application items. A fail sends the worker back to the NDIS Code of Conduct course."),
]

HUBS = [
    ("H-01", "Human Rights Hub", ["RR-09", "RR-10", "RR-07"]),
    ("H-02", "Restrictive Practices Hub", ["PS-03", "PS-01"]),
    ("H-03", "Infection Prevention and Control Hub", ["SE-05", "SE-13", "SE-15", "SE-02", "SE-03"]),
    ("H-04", "Manual Handling Hub", ["SE-06", "SE-07", "SE-08", "SE-09", "SE-10"]),
    ("H-05", "Hand Hygiene Hub", ["SE-15"]),
]


def parent_points(by_code: dict, codes: list) -> list:
    points = []
    for code in codes:
        course = by_code.get(code)
        if not course:
            continue
        for step in course["lesson"]["steps"]:
            if step["kind"] == "learn":
                points.append((step["title"], (step.get("points") or [step["title"]])[0]))
    return points


def build_checkpoints(by_code: dict) -> list:
    built = []
    for code, title, parents, rules in CHECKPOINTS:
        points = parent_points(by_code, parents)
        questions = []
        while len(questions) < 10 and points:
            lesson_title, point = points[len(questions) % len(points)]
            questions.append(
                question(
                    f"{code.lower()}-q{len(questions)+1}",
                    f"Checkpoint: which practice is correct for {lesson_title.lower()}?",
                    point if point.endswith(".") is False else point.rstrip("."),
                    UNSAFE[:2],
                )
            )
        lesson = {
            "version": 1,
            "steps": [
                learn(
                    f"{code.lower()}-intro",
                    title,
                    [
                        rules,
                        "You have one sitting. You need 80% to pass. A pass records the refresher. A fail means you complete the full course, and that exam counts as the refresher.",
                    ],
                    [f"Parent courses: {', '.join(parents)}"],
                    COVERS["CP"],
                ),
                exam(title, questions, "Ten questions. You need 80% to pass. This sitting is the refresher."),
            ],
        }
        built.append(
            catalogue_entry(
                {
                    "code": code,
                    "title": title,
                    "purpose": rules,
                    "audience": "Workers due for this refresher",
                    "standards": f"Refresher for {', '.join(parents)}",
                    "requirement_status": "Checkpoint refresher",
                    "refresher": "",
                    "parent": ", ".join(parents),
                },
                "checkpoint",
                lesson,
            )
        )
    return built


def build_hubs(by_code: dict) -> list:
    built = []
    for code, title, parents in HUBS:
        steps = []
        for parent in parents:
            course = by_code.get(parent)
            if not course:
                continue
            learns = [step for step in course["lesson"]["steps"] if step["kind"] == "learn"][:2]
            for step in learns:
                steps.append(
                    learn(
                        f"{code.lower()}-{step['id']}",
                        f"{parent}: {step['title']}",
                        step["paragraphs"],
                        step.get("points") or [],
                        COVERS["H"],
                    )
                )
        if not steps:
            steps.append(learn(f"{code.lower()}-intro", title, [title], parents, COVERS["H"]))
        steps.append(
            exam(
                title,
                [
                    question(
                        f"{code.lower()}-q1",
                        "What is this hub for?",
                        "A collection of the course material for a face-to-face team session. It is not a competency assessment.",
                        ["A replacement for the full course exam", "Proof that practical competency has been signed off"],
                    )
                ],
                "This hub is not a competency assessment. Confirm you know what it is for. Access is recorded on your worker record.",
            )
        )
        built.append(
            catalogue_entry(
                {
                    "code": code,
                    "title": title,
                    "purpose": f"Session material drawn from {', '.join(parents)}. Not assessed as a competency.",
                    "audience": "Leaders running face-to-face sessions",
                    "standards": f"Draws from {', '.join(parents)}",
                    "requirement_status": "Resource hub",
                    "refresher": "",
                    "parent": ", ".join(parents),
                },
                "hub",
                steps and {"version": 1, "steps": steps},
            )
        )
    return built


def catalogue_entry(raw: dict, kind: str, lesson: dict) -> dict:
    code = raw["code"]
    family = family_of(code)
    renewal = months_from(raw.get("refresher", "")) if kind == "course" else None
    if kind == "checkpoint":
        renewal = None
    description = raw.get("purpose") or raw.get("content") or raw.get("rules") or ""
    if kind == "bite":
        description = f"Five-minute refresher from {raw['parent']}. {raw['content']}"
    return {
        "code": code,
        "title": raw["title"],
        "description": description[:500],
        "audience": raw.get("audience") or ("All staff" if kind != "bite" else "As per parent course"),
        "standards": raw.get("standards") or "",
        "requirement_status": raw.get("requirement_status") or ("Refresher" if kind != "course" else ""),
        "kind": kind,
        "family": FAMILIES[family],
        "renewal_months": renewal,
        "required": is_required(raw.get("requirement_status", "")) if kind == "course" else False,
        "pass_mark": 80,
        "cover_image": COVERS[family],
        "parent": raw.get("parent"),
        "lesson": lesson,
    }


def main() -> None:
    text = clean(SOURCE.read_text())
    courses = parse_courses(text)
    entries = []
    for course in courses:
        if not course["lessons"]:
            raise SystemExit(f"No lessons parsed for {course['code']}")
        entries.append(catalogue_entry(course, "course", build_lesson(course)))
    for bite in build_bites(text):
        entries.append(
            catalogue_entry(
                {
                    **bite,
                    "audience": "As per parent course",
                    "standards": f"Refresher bite for {bite['parent']}",
                    "requirement_status": "Bite refresher",
                    "refresher": "",
                },
                "bite",
                build_bite_lesson(bite),
            )
        )
    by_code = {item["code"]: item for item in entries}
    entries.extend(build_checkpoints(by_code))
    entries.extend(build_hubs(by_code))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(entries, indent=2))
    print(f"courses {sum(1 for item in entries if item['kind']=='course')}")
    print(f"bites {sum(1 for item in entries if item['kind']=='bite')}")
    print(f"written {OUT}")


if __name__ == "__main__":
    main()
