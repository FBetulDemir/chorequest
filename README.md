# ChoreQuest — Household Chores + Points (Next.js + Firebase)

Deployed: https://chorequest-game.vercel.app/

ChoreQuest is a two-person (or small household) chore tracker where recurring chores are assigned points based on difficulty. Household members can complete chores, earn points, and view a leaderboard over different time ranges.

This project uses **Next.js (App Router)** and **Firebase (Auth + Firestore)**.

---

## Features

- **Authentication**
  - Sign up / sign in (Firebase Auth)

- **User profiles**
  - Stored in Firestore at `users/{uid}`
  - Includes `name` and `householdId`

- **Households**
  - Create a household
  - Join a household by code
  - View household members

- **Chore templates**
  - Create recurring chores (daily/weekly/monthly/seasonal)
  - Difficulty/points per chore
  - Assignee modes:
    - Anyone
    - Fixed person
    - Rotating

- **Today**
  - Shows chores due today and upcoming
  - Complete / skip chores
  - Shows “Completed Today” activity + points earned today

- **Score / Leaderboard**
  - Weekly / monthly / all-time score views
  - Points are computed from the ledger

---

## Tech Stack

- **Next.js** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Firebase Authentication**
- **Cloud Firestore**

---

## Data Model (Firestore)

### User profile
`users/{uid}`
```json
{
  "uid": "string",
  "email": "string | null",
  "name": "string",
  "householdId": "string | null",
  "createdAt": "number",
  "updatedAt": "number"
}
