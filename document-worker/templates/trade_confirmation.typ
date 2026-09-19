#let data = json("input.json")

#set page(paper: "a4", margin: 2cm)
#set text(size: 10pt)

#let ref = data.at("dealReference", default: "")
#let txn = data.at("transactionType", default: "")
#let snapshot = data.at("commercialTermsSnapshot", default: (:))
#let reqOrg = snapshot.at("requesterOrganizationId", default: "")
#let cpOrg = snapshot.at("counterpartyOrganizationId", default: "")

#align(center)[
  #text(size: 1.5em, weight: "bold")[Trade Confirmation]
  #v(0.3em)
  #text(size: 1.1em)[#ref]
]

#v(1.5em)

= Parties
#table(
  columns: (5cm, 1fr),
  [Requester organization], [#reqOrg],
  [Counterparty organization], [#cpOrg],
)

= Transaction
#table(
  columns: (5cm, 1fr),
  [Transaction type], [#txn],
  [Booked at], [#data.at("bookedAt", default: "")],
)
