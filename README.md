# Luminara Health Web Platform

Luminara is a private reproductive and postpartum health application designed with privacy-by-design principles. This repository contains the code for the Luminara Health landing page, waitlist signup page, legal terms, and brand story presentation deck, along with a backend API for waitlist subscriptions.

## 🚀 Technologies

### Front-End
- **Markup & Structure**: HTML5 with semantic hierarchy.
- **Styling**: Modern, custom CSS3 utilizing custom properties (variables), transitions, keyframe animations, and custom layout frameworks (CSS Grid & Flexbox). No third-party utility frameworks like Tailwind CSS are used, ensuring custom styling control.
- **Interactions & Logic**: Vanilla JavaScript for dynamic interactions.
- **Internationalization (i18n)**: Custom translation engine (`i18n.js`) supporting English and Arabic (RTL layout) with Jordanian voice styling.
- **Graphics**: Custom vector inline SVGs, featuring an interactive pulsing/glowing 3D loading teaser mobile mockup.

### Back-End API (located in `/api`)
- **Framework**: NestJS (TypeScript)
- **Database ORM**: Prisma
- **Services**: Database integration, transactional mailing service.

---

## 📁 Repository Structure

```
├── index.html                  # Main landing page (features, FAQ, comparative table)
├── waitlist.html               # Dedicated waitlist subscription page
├── waitlist.css                # Custom styling for the waitlist page
├── legal.html                  # Legal documents page (Privacy Policy, Terms of Service, Support Form)
├── legal.css                   # Custom styling for the legal tabs and forms
├── luminara-brand-story.html   # Interactive brand story presentation deck
├── styles.css                  # Global core design tokens, variables, layout systems, and custom keyframes
├── i18n.js                     # Localization engine and English/Arabic translation dictionaries
├── brand-story-i18n.js         # Translation dictionaries specific to the Brand Story deck
├── nav.js                      # Navigation menu toggles and intersection observer interactions
├── pablic/                     # Public branding assets, icons, and logos
│   ├── logo.png                # Main Luminara logo
│   ├── logoluminara.png         # Teaser header logo
│   ├── rhas-logo.png           # Royal Health Awareness Society (Main Partner) logo
│   └── og-image.png            # OpenGraph sharing preview image
└── api/                        # Backend NestJS workspace
    ├── src/                    # API source files (controllers, services, configurations)
    ├── prisma/                 # Database schema definitions and migrations
    ├── package.json            # Node backend dependencies
    └── tsconfig.json           # TypeScript configuration
```

---

## 🛠️ How to Run Locally

### 1. Running the Front-End (Static Website)
Since the front-end is written in raw HTML, CSS, and JS, you can view the website instantly by opening the `index.html` file in any modern web browser.

For local development with hot-reloading:
```bash
# Serve the root folder using a simple HTTP server
npx http-server -p 8080
```
Then navigate to `http://localhost:8080`.

### 2. Running the Back-End API
To run the waitlist collection server:
```bash
# Navigate to the API directory
cd api

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env   # Configure database credentials and mailing server keys in .env

# Generate Prisma Client & Run Migrations
npx prisma generate
npx prisma migrate dev

# Start development server
npm run start:dev
```

---

## 🤝 Partnerships

Luminara is proudly partnered with the **Royal Health Awareness Society (RHAS)** (الجمعية الملكية للتوعية الصحية) to promote healthy lifestyles and reproductive wellness in Jordan. You can visit their official portal at [https://rhas.org.jo/](https://rhas.org.jo/).
