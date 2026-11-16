# 🏨 Hostel Management System

A web-based **Hostel Management System** designed to simplify and digitize hostel administration, student services, attendance monitoring, outpass management, security operations, and communication.

The system provides separate dashboards for **Admin, Warden, Student, and Security**, allowing each role to access features and information relevant to their responsibilities.

## 📌 Project Overview

The Hostel Management System replaces traditional manual hostel management activities with a centralized digital platform.

It enables administrators to manage hostel operations, wardens to supervise students and approve outpass requests, students to access hostel services, and security personnel to monitor student entry and exit through QR codes and manual tokens.

## 👥 User Roles and Dashboards

### 1. Admin Dashboard
- Manage student and warden accounts.
- Manage hostels, rooms, and student allocations.
- Monitor attendance and hostel activities.
- Manage complaints and announcements.
- Create and update weekly mess menus.
- Monitor student outpasses and hostel status.
- View reports and analytics.

### 2. Warden Dashboard
- View and manage assigned students.
- Review, approve, or reject outpass requests.
- Monitor student attendance.
- Manage and respond to complaints.
- Publish announcements.
- Monitor hostel-related activities.

### 3. Student Dashboard
- View personal profile and hostel details.
- View attendance records.
- Apply for outpasses.
- Access approved outpass QR codes and manual tokens.
- Submit complaints.
- View announcements and poster updates.
- View the weekly mess menu.
- Use the AI-powered hostel assistant chatbot.

### 4. Security Dashboard
- Scan student outpass QR codes.
- Verify manually entered tokens.
- Record student exit and return scans.
- View students currently outside the hostel.
- View security scan history.
- Manage visitor records.
- Access emergency assistance information.

## ⭐ Key Features

### 🔐 Role-Based Authentication
- Separate access for Admin, Warden, Student, and Security.
- Role-based dashboard navigation.
- Protected pages and role-specific access.

### 🎫 Digital Outpass Management

1. Students submit outpass requests.
2. Wardens review the requests.
3. Wardens approve or reject requests.
4. Approved requests generate a QR code and an 8-character manual token.
5. Security personnel verify students at the hostel gate.
6. The approved QR code or manual token is used for exit and return verification.

### 📱 QR Code and Manual Token Verification
- QR-based gate verification.
- Manual token entry as an alternative.
- Eight-character uppercase alphanumeric manual tokens.
- Server-side token validation.
- Gate scan history and student status tracking.

### 🏠 Live Hostel Status Tracking
- Monitor students inside and outside the hostel.
- Update live status through successful gate scans.
- Maintain entry and exit records separately from attendance.

### 📅 Attendance Management
- Record and monitor student attendance.
- View attendance information through role-specific dashboards.
- Keep attendance records separate from gate movement status.

### 📢 Announcement Management
- Admin and Warden announcements.
- Poster and image-based announcements.
- Student announcement viewing.

### 🍽️ Weekly Mess Menu
- Admin can create and update the weekly mess menu.
- Students can view the published menu.

### 🤖 AI Hostel Assistant
- AI-powered chatbot for student assistance.
- Helps students find hostel-related information.

### 📊 Reports and Dashboard Monitoring
- Dashboard statistics.
- Hostel activity monitoring.
- Student and attendance information.
- Reports and analytics.

### 🚨 Emergency Assistance
- Emergency help information.
- Security support features.

## 🛠️ Technology Stack

The project uses modern web technologies for frontend development, backend services, database management, and deployment.

| Layer | Technology |
|---|---|
| Frontend | React.js |
| Backend | Node.js |
| Backend Framework | Express.js |
| Database | MongoDB |
| Additional Services / Files | Supabase (if integrated) |
| Version Control | Git and GitHub |
| Deployment Configuration | Render |

*Note: The exact database services and integrations depend on the project's current configuration.*

## 📁 Project Structure

text
HOSTEL-MANAGEMENT-SYSTEM/
│
├── .claude/
│
├── backend/
│   ├── API and server code
│   ├── Routes
│   ├── Controllers
│   ├── Models
│   └── Tests
│
├── frontend/
│   ├── public/
│   └── src/
│       ├── assets/
│       ├── components/
│       ├── context/
│       ├── hooks/
│       ├── pages/
│       │   ├── admin/
│       │   ├── student/
│       │   ├── warden/
│       │   └── security/
│       └── utils/
│
├── docs/
│   └── ui-redesign/
│
├── supabase/
│
├── .gitignore
├── README.md
└── render.yaml
```

*Note: This is a high-level representation of the project structure. Actual folders and files may change during development.*

## 🔒 Security

The system is designed with security considerations such as:

- Role-based access control.
- Protected application routes.
- Server-side validation for important operations.
- Secure handling of authentication credentials.
- Environment variables for sensitive configuration.
- Validation of QR codes and manual gate tokens.

**Important:** Never commit passwords, database credentials, API keys, or private environment files to GitHub.

## 🎯 Project Objectives

- Digitize hostel administration.
- Reduce manual paperwork.
- Improve student and warden communication.
- Simplify outpass approval and verification.
- Improve hostel gate security.
- Provide accurate student movement records.
- Make hostel information accessible through a centralized platform.

## 🚀 Future Enhancements

- Advanced hostel analytics and reports.
- Improved AI chatbot capabilities.
- Additional notification features.
- Enhanced mobile responsiveness.
- More automated hostel management workflows.

## 👨‍💻 Developer

**Project:** Hostel Management System

**Repository:** [GitHub – Hostel Management System](https://github.com/11249A018-jithendra/PROJECT)

**Author:** Jithendra (11249A018)

---

⭐ If you find this project useful, consider giving the repository a star.

**Note:** This project aims to provide a centralized digital solution for hostel management and student services.
