#import "@preview/basic-resume:0.2.9": *

#let cv = json(bytes(sys.inputs.at("cv", default: "{}")))

#let cv-type = "software" // "software" or "retail"
#let font = "TeX Gyre Termes" // "TeX Gyre Termes" or "Times New Roman"

#let name = cv.author.name
#let phone = cv.author.phone
#let location = cv.author.location
#let email = cv.author.email
#let linkedin = cv.author.linkedin
#let github = if cv-type == "software" { cv.author.github } else { "" }

#show: resume.with(
  author: name,
  email: email,
  github: github,
  location: location,
  linkedin: linkedin,
  phone: phone,
  font: font,
  paper: "us-letter",
  author-position: left,
  personal-info-position: left,
)

#show heading: set text(black)
#show title: set text(black)
#set par(justify: false)
#set text(font: font)

#let work-inverted(title: "", link: "", location: "", company: [], dates: "") = generic-two-by-two(
  top-left: strong(company) + text(weight: "thin")[, #location #if link != "" [(#link)]],
  bottom-left: emph(title),
  top-right: dates,
)

#let edu-inverted(institution: "", location: "", dates: "", degree: "") = generic-two-by-two(
  top-left: strong(institution),
  bottom-left: emph(degree),
  top-right: dates,
)

#let project-inverted(name: "", details: "") = generic-two-by-two(
  top-left: strong(name),
  bottom-left: emph(details),
  top-right: "",
  bottom-right: "",
)

#let bold-phrases(body, phrases) = phrases.fold(body, (it, phrase) => {
  show phrase: strong
  it
})
#let bolded(entry) = entry.bullets.enumerate().map(((i, bullet)) => bold-phrases(bullet, entry.at("bold", default: ()).at(i, default: ())))

#let dates(item) = (item.start, if item.end == none { "Present" } else { item.end }).filter(part => part != "").join(" - ")
#let site(url) = link("https://" + url)[#url]

#if cv.at("summary", default: "") != "" [
  == Summary
  #bold-phrases(cv.summary, cv.at("summaryBold", default: ()))
]

#if cv.experience.len() > 0 [
  == Work Experience
  #for job in cv.experience [
    #work-inverted(
      title: job.title,
      location: job.location,
      company: job.company,
      link: if job.url != "" { site(job.url) } else { "" },
      dates: dates(job),
    )
    #list(..bolded(job))
  ]
]

#if cv.projects.len() > 0 [
  == Projects
  #for project in cv.projects [
    #project-inverted(
      name: [#project.name #if project.url != "" or project.subtitle != "" { text(weight: "thin")[(#if project.url != "" { site(project.url) } else { project.subtitle })] }],
      details: if project.details != "" [(#project.details)] else [],
    )
    #list(..bolded(project))
  ]
]

#if cv.education.len() > 0 [
  == Education

  #for school in cv.education [
    #edu-inverted(
      institution: school.institution,
      location: school.location,
      dates: dates(school),
      degree: school.qualification,
    )
    #list(..school.details)
  ]
]

#if cv.skills.len() > 0 [
  == Additional Information
  #for group in cv.skills [
    *#group.label*: #group.items.join(", ") #linebreak()
  ]
]
