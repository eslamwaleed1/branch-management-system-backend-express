# Branch Management System Backend

Express and MongoDB backend for the Branch Management System React application. It provides API endpoints for branches, employees, clients, products and branch inventory, and sales.

## Features

- REST API built with Express 5
- MongoDB persistence through Mongoose
- Standalone email/password and Google authentication with hashed passwords and sessions
- Email ownership verification codes delivered over SMTP
- Branch, employee, client, product, inventory and sales management
- Inventory reservation and restoration when sales are created or deleted
- JSON seed data for the included sample dataset

## Requirements

- Node.js 20.19 or newer
- MongoDB Atlas database, or another MongoDB deployment

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root:

   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/<database>?retryWrites=true&w=majority
   SESSION_SECRET=<long-random-secret>
   FRONTEND_URL=http://localhost:5173
   GOOGLE_CLIENT_ID=<google-oauth-client-id>
   GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
   GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=<sender-gmail-address>
   SMTP_PASS=<gmail-app-password>
   EMAIL_FROM=<sender-gmail-address>
   PORT=5000
   ```

   Keep real credentials out of Git. The server can start without `MONGODB_URI`, but Mongo-backed API requests will not work.
   Google sign-in is optional; configure a Google OAuth web client and register the callback URL above to enable it. For Gmail SMTP, use a Google app password (not your normal account password) and enable 2-Step Verification. For another mail provider, use its SMTP host, port, TLS setting, and credentials. For deployment, set `FRONTEND_URL` to the deployed frontend, `GOOGLE_CALLBACK_URL` to the backend's public callback URL, and `FRONTEND_ORIGINS` to a comma-separated list of allowed frontend origins. Set a strong `SESSION_SECRET` in production.

3. Start the API:

   ```bash
   node server.js
   ```

   For development with automatic restarts:

   ```bash
   npm run devStart
   ```

The API listens on `http://localhost:5000` by default. `GET /api/test` is a basic availability check.

## API routes

All routes are prefixed with `/api` and use JSON request and response bodies.

| Resource               | Base path    | Available operations                                   |
| ---------------------- | ------------ | ------------------------------------------------------ |
| Branches               | `/branches`  | List, create, retrieve by ID or name, update, delete   |
| Employees              | `/employees` | List, create, retrieve by ID, update, delete           |
| Clients                | `/clients`   | List, create, retrieve by ID, update, delete           |
| Products and inventory | `/products`  | List, create, retrieve by ID, update, delete           |
| Sales                  | `/sales`     | List, create, retrieve by ID, update sale date, delete |
| Authentication         | `/auth`      | CSRF token, session check, email signup/login/verification, logout, Google OAuth |
| Health check           | `/test`      | Check API availability                                 |

For example, `GET /api/branches` lists branches and `POST /api/sales` creates a sale. Sales require an employee, a client in the same branch, and available inventory for each requested product. Sale line items cannot be edited; delete the sale and create a replacement instead.

Authentication users are independent of employees and all other business entities. `GET /api/auth/csrf` starts a CSRF-protected session. Send the returned token in the `X-CSRF-Token` header with auth POST requests. `POST /api/auth/signup` accepts `{ "email": "...", "password": "..." }`, requires an 8–128 character password, and emails a 6-digit code. `POST /api/auth/verification/confirm` accepts `{ "email": "...", "code": "..." }`; codes expire after 10 minutes and allow up to five attempts. `POST /api/auth/verification/resend` accepts `{ "email": "..." }` and limits resends to once per minute. Email/password login is available only after verification. Successful verification/login and Google authentication establish an HTTP-only session. Google login requires an existing account; Google signup creates one if needed. After Google redirects back to the frontend, it checks `GET /api/auth/session` before navigating to `/onboarding`. Google authentication relies on Google's verified-email response. The backend initializes a verified guest account in MongoDB (`guest@dm.com`, password `thepassword`); the "Continue as Guest" button signs into that account through the same `POST /api/auth/login` endpoint as other email/password logins. `POST /api/auth/logout` destroys the session. The frontend must include credentials for cross-origin session cookies.

## Deploy to Render

Create a **Web Service** connected to this repository. Configure:

- **Build command:** `npm install`
- **Start command:** `node server.js`
- **Environment variable:** `MONGODB_URI` set to the Atlas connection string
- **Environment variable:** `SESSION_SECRET` set to a long random secret
- **Environment variable:** `FRONTEND_URL` set to the deployed frontend origin
- **Environment variable:** `FRONTEND_ORIGINS` set to allowed frontend origins
- **Environment variables:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and optionally `EMAIL_FROM` for verification mail
- **Google OAuth (optional):** set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` to the registered OAuth client values
- **Optional environment variable:** `PORT` (Render provides this automatically)

In MongoDB Atlas, create a database user and allow network access from the Render service. Render outbound addresses may vary by plan; follow Render's current outbound-IP guidance when restricting the Atlas IP access list. Do not commit database credentials.

## Connect the Vercel frontend

The API allows `http://localhost:5173` and exact origins listed in `FRONTEND_ORIGINS`. Add the deployed frontend and any intended preview origins to `FRONTEND_ORIGINS`. The React application should call the deployed Render service's `/api` endpoints and include credentials for auth sessions.

## Important data behavior

The server schedules `refreshDatabase` to run at the top of every hour. That job deletes all documents in the six application collections and repopulates them from the JSON files in `server/data`. Changes made through the API are therefore temporary and will be discarded on the next run. Disable or replace this scheduled reset before using a persistent or production Atlas database.
