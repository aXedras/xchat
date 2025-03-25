
import { Company } from "@/types/chat";

export const companies: Company[] = [
  {
    id: "1",
    name: "Argor-Heraeus",
    location: "Switzerland",
    type: "Refiner",
    users: [
      { id: "1-1", name: "Jane Smith", role: "Sales Manager" },
      { id: "1-2", name: "Robert Chen", role: "Operations Director" },
      { id: "1-3", name: "Elena Müller", role: "Compliance Officer" }
    ]
  },
  {
    id: "2",
    name: "PAMP",
    location: "Switzerland",
    type: "Refiner",
    users: [
      { id: "2-1", name: "Michael Thompson", role: "CEO" },
      { id: "2-2", name: "Sarah Miller", role: "Head of Trading" }
    ]
  },
  {
    id: "3",
    name: "Valcambi",
    location: "Switzerland",
    type: "Refiner",
    users: [
      { id: "3-1", name: "Thomas Weber", role: "Chief Technology Officer" },
      { id: "3-2", name: "Lisa Johnson", role: "Supply Chain Manager" }
    ]
  },
  {
    id: "4",
    name: "Royal Canadian Mint",
    location: "Canada",
    type: "Mint",
    users: [
      { id: "4-1", name: "David Wilson", role: "Product Manager" },
      { id: "4-2", name: "Emily Brown", role: "Head of Security" }
    ]
  },
  {
    id: "5",
    name: "Brinks Global Services",
    location: "United States",
    type: "Logistics",
    users: [
      { id: "5-1", name: "James Clark", role: "Operations Manager" },
      { id: "5-2", name: "Patricia Martinez", role: "Client Relations" }
    ]
  }
];
