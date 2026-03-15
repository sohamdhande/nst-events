# NST-Connect

NST-Connect is a campus event management platform built for Newton School of Technology, Pune, designed to unify student events, club operations, attendance, and communication into one digital system.

The platform allows students to discover and register for campus events, track schedules, monitor leaderboards, and manage participation, while club administrators and administrators can create events, manage attendance, and control club-level operations.

---

# Overview

NST-Connect is designed to solve common campus event challenges:

* fragmented event communication
* manual registrations
* attendance fraud
* disconnected club operations
* poor visibility of campus activities

The goal is to create a centralized event ecosystem where all clubs and campus activities are managed through one platform.

---

# Core Features

## Student Features

* NST email-based login authentication
* Event discovery across all campus clubs
* Event registration
* Event schedule tracking
* QR-based attendance system
* Leaderboard access
* Notifications for new events and updates
* Personal profile management
* Registered events history

---

## Club Admin Features

* Club-specific dashboard
* Create and manage club events
* Edit event details
* Generate QR attendance sessions
* View participant lists
* Attendance analytics
* Slack integration for event updates
* Club details and event insights

---

## Admin Features

* Manage all users
* Manage all clubs
* Approve or control events
* Monitor campus-wide analytics
* Assign club admins
* System-wide control over notifications and permissions

---

# Multi-Club Architecture

NST-Connect supports multiple clubs inside the same campus ecosystem.

Example clubs:

* Developer Club
* Competitive Programming Club
* AI/ML Club
* Arts Club
* Sports Club
* E-Sports Club

Each club has:

* dedicated identity
* club admins
* events
* announcements
* club-specific operations

---

# Role System

NST-Connect uses role-aware authentication.

## Supported Roles

* student
* club_admin
* admin

A single user can have multiple roles.

Example:

A student may also be a club admin.

This allows:

* participant mode for students
* club dashboard access for club admins
* complete control for admins

---

# Authentication

Login is restricted to institutional email access.

Allowed domain:

```txt
@adypu.edu.in  or @newtonschool.co
```

Authentication flow:

* user logs in using institutional email
* backend resolves assigned roles
* UI changes based on permissions

---

# Attendance System

NST-Connect uses QR-based attendance.

## Attendance Flow

* club admin generates dynamic QR
* participant scans QR during event
* backend validates registration
* attendance marked instantly

## Why QR-based

* removes manual attendance
* reduces proxy marking
* improves speed during events

---

# Slack Integration

NST-Connect supports Slack-based event broadcasting.

When:

* a new event is created
* an event is updated

The system sends event information automatically to Slack channels.

This helps clubs maintain communication beyond the app.

---

# System Architecture

NST-Connect follows modular monolith architecture.

## Backend Pattern

Controller → Service → Repository

Modules:

* auth
* users
* clubs
* events
* attendance
* notifications
* leaderboard
* integrations

---

# Recommended Tech Stack

## Mobile Application

* React Native
* Expo
* React Navigation
* Zustand

## Admin Dashboard

* Next.js

## Backend

* Node.js
* Express.js

## Database

* PostgreSQL
* Prisma ORM

## Authentication

* Google OAuth (restricted institutional domain)
* JWT

## Notifications

* Firebase Cloud Messaging

## Attendance

* QRCode generation
* react-native-vision-camera

## Integrations

* Slack Webhooks

---

# UI Philosophy

NST-Connect follows a clean institutional mobile design.

## Theme Identity

Primary Colors:

* Blue #0052FF
* Orange #FFA500
* Mint #4FD1C5

Typography:

* Orbitron for headings
* Inter for body text

Design Goals:

* premium
* minimal
* modern student-focused

---

# Future Expansion

NST-Connect is designed to evolve beyond event handling.

Possible future modules:

* certificate generation
* club recruitment
* event media galleries
* campus leaderboard by clubs
* attendance analytics
* multi-campus deployment

---

# Long-Term Vision

NST-Connect is intended to become:

A campus operating platform where events, clubs, participation, and communication are managed through one scalable digital layer.
