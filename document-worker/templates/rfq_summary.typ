#let data = json("input.json")

#set page(paper: "a4", margin: 2cm)
#set text(size: 10pt)

#let ref = data.at("publicReference", default: "RFQ")
#let txn = data.at("transactionType", default: "")
#let terms = data.at("terms", default: (:))

#align(center)[
  #text(size: 1.5em, weight: "bold")[RFQ Summary]
  #v(0.3em)
  #text(size: 1.1em)[#ref]
]

#v(1.5em)

#let commercial = terms.at("commercial", default: (:))
#let material = terms.at("material", default: (:))
#let assay = terms.at("assay", default: (:))
#let logistics = terms.at("logistics", default: (:))

= Commercial
#table(
  columns: (4cm, 1fr),
  [Transaction type], [#txn],
  [Response deadline], [#commercial.at("responseDeadline", default: "")],
  [Settlement currency], [#commercial.at("settlementCurrency", default: "")],
)

= Material
#table(
  columns: (4cm, 1fr),
  [Primary metal], [#material.at("primaryMetal", default: "")],
  [Material form], [#material.at("materialForm", default: "")],
  [Product], [#material.at("productName", default: "")],
  [Quantity], [#material.at("quantity", default: "") #h(0.3em) #material.at("quantityUnit", default: "")],
)

= Assay
#table(
  columns: (4cm, 1fr),
  [Assay status], [#assay.at("assayStatus", default: "")],
  [Assay method], [#assay.at("assayMethod", default: "")],
)

= Logistics
#let current = logistics.at("currentLocation", default: (:))
#table(
  columns: (4cm, 1fr),
  [Current location], [#current.at("countryCode", default: "") #h(0.3em) #current.at("locality", default: "")],
  [Available from], [#logistics.at("availabilityFrom", default: "")],
)
