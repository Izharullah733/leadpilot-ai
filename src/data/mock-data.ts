import type { Appointment, Lead, TeamMember } from "@/types";

const rawLeads = [
  ["LP-1001","Ali Raza","+92 300 1234567","ali.raza@example.com","Complete House Construction","DHA Phase 6, Lahore","10 Marla",28500000,"Within 1 month","Facebook Ads","Ahmed Khan",92,"Hot","Negotiation","2026-07-23","2026-07-06","Client has approved the initial layout and wants a detailed BOQ."],
  ["LP-1002","Ayesha Siddiqui","+92 321 4455678","ayesha.s@example.com","Interior Design","Bahria Town, Islamabad","1 Kanal",12500000,"Within 3 months","Instagram","Sara Malik",86,"Hot","Proposal Sent","2026-07-23","2026-07-08","Interested in contemporary interiors and turnkey execution."],
  ["LP-1003","Fahad Mehmood","+92 333 8765421","fahad.m@example.com","Commercial Construction","Blue Area, Islamabad","8,000 sq ft",72000000,"Within 1 month","Referral","Usman Ali",95,"Hot","Site Visit","2026-07-24","2026-07-10","Corporate office project; decision-making committee is available this week."],
  ["LP-1004","Zainab Ahmed","+92 301 9988776","zainab.a@example.com","Property Purchase","Gulberg III, Lahore","2 Kanal",95000000,"Within 6 months","Property Portal","Hira Shah",72,"Warm","Qualified","2026-07-25","2026-07-11","Looking for a commercial property with reliable rental yield."],
  ["LP-1005","Hamza Javed","+92 315 2233445","hamza.j@example.com","Grey Structure Construction","Bahria Town, Rawalpindi","1 Kanal",19000000,"Within 3 months","Google Ads","Ahmed Khan",78,"Warm","Contacted","2026-07-23","2026-06-05","Comparing three contractors; values transparent material specifications."],
  ["LP-1006","Maryam Iqbal","+92 322 5566778","maryam.i@example.com","Renovation","DHA Phase 5, Karachi","500 sq yd",17500000,"Within 1 month","Website","Sara Malik",89,"Hot","Converted","2026-07-22","2026-06-12","Full kitchen, bathrooms and facade renovation required."],
  ["LP-1007","Bilal Aslam","+92 304 6677889","bilal.a@example.com","Architecture and Planning","Hayatabad, Peshawar","2 Kanal",8500000,"Within 6 months","Walk-in","Usman Ali",64,"Warm","Qualified","2026-07-26","2026-06-18","Needs concept design and authority approvals before construction."],
  ["LP-1008","Sana Tariq","+92 336 7788990","sana.t@example.com","Property Sale","Clifton, Karachi","1,000 sq yd",210000000,"Flexible","Referral","Hira Shah",81,"Hot","Converted","2026-07-24","2026-06-25","Owner wants discreet marketing to qualified buyers."],
  ["LP-1009","Omer Farooq","+92 300 8899001","omer.f@example.com","Complete House Construction","G-13, Islamabad","14 Marla",33000000,"Within 3 months","WhatsApp","Ahmed Khan",76,"Warm","Proposal Sent","2026-07-27","2026-05-04","Family home with basement; structural drawings are ready."],
  ["LP-1010","Nimra Khan","+92 321 9900112","nimra.k@example.com","Interior Design","Askari 11, Lahore","10 Marla",6500000,"Within 1 month","Instagram","Sara Malik",69,"Warm","Contacted","2026-07-23","2026-05-11","Wants design consultation before finalizing full scope."],
  ["LP-1011","Saad Qureshi","+92 333 1011223","saad.q@example.com","Commercial Construction","Saddar, Rawalpindi","4,500 sq ft",45000000,"Within 6 months","Website","Usman Ali",58,"Cold","New Inquiry","2026-07-29","2026-05-18","Early-stage inquiry for a mixed-use building."],
  ["LP-1012","Hina Akram","+92 301 2122334","hina.a@example.com","Renovation","Model Town, Lahore","1 Kanal",14000000,"Within 3 months","Facebook Ads","Hira Shah",74,"Warm","Converted","2026-07-25","2026-05-26","Interested in energy-efficient upgrades and landscaping."],
  ["LP-1013","Waqas Nadeem","+92 315 3233445","waqas.n@example.com","Property Purchase","DHA Phase 8, Lahore","1 Kanal",78000000,"Within 1 month","Property Portal","Ahmed Khan",88,"Hot","Site Visit","2026-07-23","2026-04-07","Cash buyer; shortlisted three properties for visits."],
  ["LP-1014","Maha Shahid","+92 322 4344556","maha.s@example.com","Architecture and Planning","E-11, Islamabad","12 Marla",5200000,"Within 3 months","Google Ads","Sara Malik",67,"Warm","Contacted","2026-07-28","2026-04-16","Requires modern elevation and space-efficient plan."],
  ["LP-1015","Adnan Sheikh","+92 304 5455667","adnan.s@example.com","Grey Structure Construction","Gulshan-e-Iqbal, Karachi","400 sq yd",23500000,"Within 6 months","Referral","Usman Ali",54,"Cold","Converted","2026-07-30","2026-04-24","Land transfer is in progress; collecting preliminary estimates."],
  ["LP-1016","Rabia Noor","+92 336 6566778","rabia.n@example.com","Complete House Construction","DHA Phase 2, Islamabad","1 Kanal",49000000,"Within 1 month","Website","Hira Shah",91,"Hot","Proposal Sent","2026-07-22","2026-03-06","Ready to proceed after final scope and payment milestone review."],
  ["LP-1017","Talha Mirza","+92 300 7677889","talha.m@example.com","Property Sale","Bahria Town, Karachi","500 sq yd",68000000,"Flexible","WhatsApp","Ahmed Khan",48,"Cold","Contacted","2026-08-01","2026-03-17","Exploring market price; no immediate urgency."],
  ["LP-1018","Iqra Yousaf","+92 321 8788990","iqra.y@example.com","Interior Design","Johar Town, Lahore","5 Marla",3900000,"Within 3 months","Instagram","Sara Malik",62,"Warm","Qualified","2026-07-26","2026-03-27","Needs compact storage solutions and a warm neutral palette."],
  ["LP-1019","Danish Abbasi","+92 333 9899001","danish.a@example.com","Commercial Construction","University Road, Peshawar","12,000 sq ft",110000000,"Within 6 months","Walk-in","Usman Ali",84,"Hot","Negotiation","2026-07-24","2026-02-10","Retail plaza; financing and approvals are in place."],
  ["LP-1020","Mehwish Saleem","+92 301 0900112","mehwish.s@example.com","Renovation","F-8, Islamabad","2 Kanal",26000000,"Within 3 months","Facebook Ads","Hira Shah",57,"Cold","New Inquiry","2026-07-31","2026-02-22","Requested portfolio and rough cost range by email."],
] as const;

export const initialLeads: Lead[] = rawLeads.map((lead) => ({
  id: lead[0], fullName: lead[1], phone: lead[2], email: lead[3], service: lead[4],
  location: lead[5], propertySize: lead[6], budget: lead[7], timeline: lead[8],
  source: lead[9], salesperson: lead[10], score: lead[11], status: lead[12],
  stage: lead[13], nextFollowUp: lead[14], createdAt: lead[15], notes: lead[16],
})) as Lead[];

export const team: TeamMember[] = [
  { name: "Ahmed Khan", initials: "AK", role: "Senior Sales Manager", email: "ahmed@primebuild.pk" },
  { name: "Sara Malik", initials: "SM", role: "Property Consultant", email: "sara@primebuild.pk" },
  { name: "Usman Ali", initials: "UA", role: "Business Development", email: "usman@primebuild.pk" },
  { name: "Hira Shah", initials: "HS", role: "Sales Executive", email: "hira@primebuild.pk" },
];

export const initialAppointments: Appointment[] = [
  { id: 1, type: "Site Visit", customer: "Fahad Mehmood", location: "Blue Area, Islamabad", date: "2026-07-24T11:00:00", salesperson: "Usman Ali", status: "Confirmed" },
  { id: 2, type: "Consultation", customer: "Ayesha Siddiqui", location: "Prime Build Office, Islamabad", date: "2026-07-24T15:30:00", salesperson: "Sara Malik", status: "Confirmed" },
  { id: 3, type: "Site Visit", customer: "Waqas Nadeem", location: "DHA Phase 8, Lahore", date: "2026-07-25T10:00:00", salesperson: "Ahmed Khan", status: "Pending" },
  { id: 4, type: "Consultation", customer: "Rabia Noor", location: "Video call", date: "2026-07-25T16:00:00", salesperson: "Hira Shah", status: "Confirmed" },
  { id: 5, type: "Site Visit", customer: "Danish Abbasi", location: "University Road, Peshawar", date: "2026-07-27T12:00:00", salesperson: "Usman Ali", status: "Pending" },
];
