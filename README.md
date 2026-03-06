# Parking Management System

A streamlined parking reservation system with one-click booking and admin management.

## 🚀 Local Setup

1.  **Clone or Download** the source code.
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Configure Environment**:
    Create a `.env` file in the root directory and add your MongoDB connection string:
    ```env
    MONGODB_URI=your_mongodb_connection_string
    ```
4.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    The app will be available at `http://localhost:3000`.

## 🛠 Features

-   **User View**: Real-time parking slot availability and instant reservation.
-   **Admin View**: Password-protected dashboard to manage all reservations and view history.
    -   **Password**: `#1Pklipl`
-   **Time Tracking**: Automatically records start and end times for all reservations.

## 🌐 Deployment

### Render.com (Recommended)
1.  Connect your GitHub repo.
2.  Build Command: `npm run build`
3.  Start Command: `npm start`
4.  Add `MONGODB_URI` in Environment variables.

### Netlify
1.  Connect your GitHub repo.
2.  Build Command: `npm run build`
3.  Publish Directory: `dist`
4.  Functions Directory: `functions`
5.  Add `MONGODB_URI` in Environment variables.
6.  In MongoDB Atlas → Network Access, allow connections from `0.0.0.0/0` (Netlify has no fixed IP).

---

## 🐛 Bug Fixes & Corrections — 2026-03-06

### Issues Found

| # | File | Issue | Severity |
|---|------|-------|----------|
| 1 | `package.json` | `better-sqlite3` (native C++ module) was listed as a dependency but is not used anywhere — MongoDB is used instead. Netlify's build environment cannot compile native bindings, causing build failures. | **Critical** |
| 2 | `netlify.toml` | Missing `[functions]` section with `node_bundler = "esbuild"`. Without this, Netlify may use an older bundler that fails to handle TypeScript + ESM correctly. | **Important** |
| 3 | `src/api.ts` | `client.connect()` was called every time `connectDB()` ran if `db` was null but `client` already existed. Calling `.connect()` on an already-connected `MongoClient` throws an error, causing silent failures on warm Lambda invocations. | **Bug** |

### Corrections Applied

**1. Removed `better-sqlite3` from `package.json`**
```diff
- "better-sqlite3": "^12.4.1",
```

**2. Added esbuild bundler config to `netlify.toml`**
```toml
[functions]
  node_bundler = "esbuild"
```

**3. Fixed MongoDB connection guard in `src/api.ts`**
```diff
- if (!client) {
-   client = new MongoClient(MONGO_URI);
- }
- await client.connect();
+ if (!client) {
+   client = new MongoClient(MONGO_URI);
+   await client.connect();
+ }
```
`client.connect()` is now only called when creating a new client instance, preventing double-connect errors on warm serverless invocations.

### Verified
- `npm install` completed with 0 vulnerabilities after removing `better-sqlite3`.
- Dev server starts and connects to MongoDB Atlas successfully.
- `/api/slots` returns live data from the cloud database.
