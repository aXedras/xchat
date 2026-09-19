#let data = json("input.json")

#set page(paper: "a4", margin: 2cm)
#set text(size: 10pt)

#let ref = data.at("publicReference", default: "")
#let txn = data.at("transactionType", default: "")
#let commercial = data.at("commercial", default: (:))
#let components = data.at("pricingComponents", default: ())
#let assay = data.at("assay", default: (:))

#align(center)[
  #text(size: 1.5em, weight: "bold")[Quotation]
  #v(0.3em)
  #text(size: 1.1em)[#ref]
]

#v(1.5em)

= Validity
#commercial.at("validUntil", default: "")

= Pricing components
#if components == () [
  No pricing components.
] else [
  #for c in components [
    - #c.at("componentType", default: "") — #c.at("label", default: ""):
      #if c.at("calculationMethod", default: "") == "FORMULA" [
        formula: #c.at("formulaText", default: "")
      ] else [
        #c.at("numericValue", default: "") #h(0.3em) #c.at("currencyCode", default: "")
      ]
  ]
]

= Assay
#table(
  columns: (4cm, 1fr),
  [Payability], [#assay.at("payability", default: "")],
  [Deductions], [#assay.at("deductions", default: "")],
)
