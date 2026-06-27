# AI Marketing Studio

Platformë inovative e cila kthen imazhin dhe përshkrimin e një produkti në një video marketingu vertikale 30-45 sekondëshe të gatshme për t'u publikuar në TikTok, Instagram Reels, dhe YouTube Shorts.

---

## 2. Përshkrimi (Description)

**AI Marketing Studio** është një aplikacion që automatizon krijimin e videove reklamuese për produkte të ndryshme. Qëllimi kryesor është t'u mundësojë bizneseve dhe krijuesve të gjenerojnë reklama video me cilësi të lartë brenda pak minutave pa pasur nevojë për aftësi të montimit të videove. 

Duke u nisur vetëm nga një foto e produktit dhe një përshkrim i shkurtër:
- **Skenari me Inteligjencë Artificiale**: Backend-i shkruan një skenar të strukturuar në skena me inteligjencë artificiale.
- **Kërkimi i Mediave**: Gjen automatikisht pamjet më të përshtatshme (video) nga Pexels.
- **Zëri me AI (Voiceover)**: Gjeneron zërin (voiceover) përmes inteligjencës artificiale me sinkronizim të plotë kohor.
- **Montimi i Automatizuar (FFmpeg)**: Bashkon dhe monton gjithçka përmes FFmpeg (shton titra të animuar, muzikë në sfond që ulet automatikisht kur flitet, tranzicione).
- **Shkarkimi**: Ofron videon finale MP4 të gatshme për shkarkim.

---

## 3. Teknologjitë e Përdorura

Aplikacioni është i ndërtuar duke përdorur një arkitekturë moderne dhe të shpejtë:

* **Frontend:**
  - React.js + TypeScript
  - Vite (për build-im të shpejtë)
  - TailwindCSS (për stilim premium dhe responsive)
  - Framer Motion (për mikro-animacione të lëmuara)

* **Backend:**
  - Node.js + Express
  - MongoDB (Databaza për ruajtjen e përdoruesve dhe statusin e gjenerimit të videove)
  - Redis + BullMQ (për menaxhimin e radhës së punëve asinkrone të gjenerimit të videove)

* **Integrimet e AI & Media (API):**
  - OpenAI (për shkrimin e skenarit inteligjent)
  - Deepgram (për gjenerimin e zërit realist/TTS dhe sinkronizimin e titrave)
  - Pexels API (për gjetjen e videove/pamjeve ilustruese)
  - Stability AI & Replicate (për gjenerimin e imazheve si zgjidhje rezervë nëse mungojnë mediat)

* **Përpunimi i Videove:**
  - FFmpeg + fluent-ffmpeg (për montimin, prerjen, shtimin e titrave dhe zërit)

---

## 4. Si me e startu projektin (Installation)

Për të nisur projektin në kompjuterin tuaj lokal, ndiqni hapat e mëposhtëm:

### Hapi 1: Klono projektin dhe instalo varësitë (Dependencies)
Në direktorinë rrënjë (root) të projektit, ekzekutoni:
```bash
# Instalon varësitë për të gjithë projektin (Backend & Frontend duke përdorur npm workspaces)
npm install
```

### Hapi 2: Konfigurimi i skedarëve `.env`
Duhet të konfiguroni skedarët e mjedisit në të dyja direktoritë (Backend dhe Frontend):

1. **Për Backend:**
   - Shkoni tek direktoria `backend` dhe kopjoni `.env.example` në `.env`:
     ```bash
     cp backend/.env.example backend/.env
     ```
   - Plotësoni çelësat e nevojshëm API në `backend/.env` (si `OPENAI_API_KEY`, `DEEPGRAM_API_KEY`, `PEXELS_API_KEY`).
   - Për lidhjen me Databazën, vendosni URL-në tuaj të MongoDB tek `MONGODB_URI` (p.sh. MongoDB Atlas siç është caktuar ose databaza lokale `mongodb://127.0.0.1:27017/ai-marketing-studio`).

2. **Për Frontend:**
   - Shkoni tek direktoria `frontend` dhe kopjoni `.env.example` në `.env`:
     ```bash
     cp frontend/.env.example frontend/.env
     ```
   - Sigurohuni që adresa e API-t është e saktë (si default është `VITE_API_BASE_URL=http://localhost:5000/api`).

### Hapi 3: Nisja e Databazës dhe Redis (Opsionale përmes Docker)
Nëse dëshironi të nisni shërbimet e MongoDB dhe Redis lokalisht përmes Docker:
```bash
docker compose up -d mongodb redis
```

### Hapi 4: Nisja e Projektit në Zhvillim (Development Mode)
Mund ta ndizni backend-in dhe frontend-in paralelisht nga direktoria rrënjë (root):

* **Nisja e Backend-it (API):**
  ```bash
  npm run dev --workspace backend
  ```

* **Nisja e Worker-it (BullMQ):**
  ```bash
  npm run worker:dev --workspace backend
  ```

* **Nisja e Frontend-it:**
  ```bash
  npm run dev --workspace frontend
  ```

Aplikacioni do të jetë i disponueshëm në:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`

---

## 5. Funksionalitetet kryesore (Key Features)

Përdoruesi mund të kryejë këto veprime në aplikacion:

* **Ngarkimi i Produktit (Drag & Drop):** Ngarkim i imazhit të produktit dhe shkrim i një përshkrimi ose udhëzuesi të shkurtër (brief).
* **Skenarë të Automatizuar me AI**: Krijim i skenarit prej 4-6 skenash të ndara me strukturë profesionale (Hook, Body, CTA).
* **Ndjekje e Progresit në Kohë Reale**: Shikimi i çdo faze të gjenerimit (skenari, mediat, zëri, renderimi) përmes një ndërfaqeje dinamike në kohë reale.
* **Titra të Sinkronizuara me Zë**: Zëri me AI dhe titrat moderne me ngjyra përshtaten fjalë për fjalë me njëra-tjetrën.
* **Muzikë Sfondi me Audio Ducking**: Volumi i muzikës ulet automatikisht sa herë që flet zëri i inteligjencës artificiale.
* **Player & Shkarkim**: Shikimi i videos së gjeneruar direkt në faqe dhe shkarkimi i saj si skedar MP4 me cilësi të lartë (1080x1920).
