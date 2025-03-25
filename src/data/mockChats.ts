
import { Chat, Message } from "../types/chat";

export const initialChats: Chat[] = [
  {
    id: "1",
    name: "Jane Smith - Argor-Heraeus",
    lastMessage: "ASK 10x1KG AU LBMA good delivery LND fixing 18.03 +0.3",
    timestamp: "10:23 AM",
    unread: 2,
    avatar: "https://source.unsplash.com/random/40x40/?portrait&1"
  },
  {
    id: "2",
    name: "Michael Thompson - PAMP",
    lastMessage: "Will send you the certification details soon",
    timestamp: "Yesterday",
    unread: 0,
    avatar: "https://source.unsplash.com/random/40x40/?portrait&2"
  },
  {
    id: "3",
    name: "Refiners Group",
    lastMessage: "John: Can anyone share recent audit experiences?",
    timestamp: "Monday",
    unread: 5,
    isGroup: true,
    members: ["You", "John Davis", "Sarah Miller", "Robert Chen"]
  },
  {
    id: "4",
    name: "North American Operations",
    lastMessage: "Price update for March contracts",
    timestamp: "03/15/2023",
    unread: 0,
    isCompany: true
  },
  {
    id: "5",
    name: "Sarah Miller - Valcambi",
    lastMessage: "Ask Airwaybill for #123456",
    timestamp: "03/10/2023",
    unread: 0,
    avatar: "https://source.unsplash.com/random/40x40/?portrait&3"
  }
];

export const initialMessages: Record<string, Message[]> = {
  "1": [
    {
      id: "1-1",
      content: "Hello, I'm looking for gold bars for our client",
      sender: "Jane Smith",
      timestamp: "10:20 AM",
      status: "read",
      isMine: false
    },
    {
      id: "1-2",
      content: "We have several options available. What specifications are you looking for?",
      sender: "You",
      timestamp: "10:21 AM",
      status: "read",
      isMine: true
    },
    {
      id: "1-3",
      content: "ASK 10x1KG AU LBMA good delivery LND fixing 18.03 +0.3",
      sender: "Jane Smith",
      timestamp: "10:23 AM",
      status: "read",
      isMine: false,
      isMacro: true
    }
  ],
  "2": [
    {
      id: "2-1",
      content: "I need information about your platinum supply chain",
      sender: "Michael Thompson",
      timestamp: "Yesterday 3:45 PM",
      status: "read",
      isMine: false
    },
    {
      id: "2-2",
      content: "I'll prepare a document with our supply chain details. Do you need specific certification?",
      sender: "You",
      timestamp: "Yesterday 4:00 PM",
      status: "read",
      isMine: true
    },
    {
      id: "2-3",
      content: "Yes, we need LBMA chain of custody documentation",
      sender: "Michael Thompson",
      timestamp: "Yesterday 4:15 PM",
      status: "read",
      isMine: false
    },
    {
      id: "2-4",
      content: "Will send you the certification details soon",
      sender: "Michael Thompson",
      timestamp: "Yesterday 4:16 PM",
      status: "delivered",
      isMine: false
    }
  ]
};
