# Branch Management System Backend

Express and MongoDB backend for the Branch Management System React application. It provides API endpoints for branches, employees, clients, products and branch inventory, and sales.

## Features

- REST API built with Express 5
- MongoDB persistence through Mongoose
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
   PORT=5000
   ```

   Keep real credentials out of Git. The server can start without `MONGODB_URI`, but Mongo-backed API requests will not work.

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

| Resource | Base path | Available operations |
| --- | --- | --- |
| Branches | `/branches` | List, create, retrieve by ID or name, update, delete |
| Employees | `/employees` | List, create, retrieve by ID, update, delete |
| Clients | `/clients` | List, create, retrieve by ID, update, delete |
| Products and inventory | `/products` | List, create, retrieve by ID, update, delete |
| Sales | `/sales` | List, create, retrieve by ID, update sale date, delete |
| Health check | `/test` | Check API availability |

For example, `GET /api/branches` lists branches and `POST /api/sales` creates a sale. Sales require an employee, a client in the same branch, and available inventory for each requested product. Sale line items cannot be edited; delete the sale and create a replacement instead.

## Deploy to Render

Create a **Web Service** connected to this repository. Configure:

- **Build command:** `npm install`
- **Start command:** `node server.js`
- **Environment variable:** `MONGODB_URI` set to the Atlas connection string
- **Optional environment variable:** `PORT` (Render provides this automatically)

In MongoDB Atlas, create a database user and allow network access from the Render service. Render outbound addresses may vary by plan; follow Render's current outbound-IP guidance when restricting the Atlas IP access list. Do not commit database credentials.

## Connect the Vercel frontend

The API currently allows browser requests only from `http://localhost:5173` in `server.js`. A deployed Vercel frontend has a different origin, so its browser requests will be blocked until the backend CORS allowlist is configured to include the frontend's production URL (and any preview URLs you intend to use). The React application should call the deployed Render service's `/api` endpoints.

## Important data behavior

The server schedules `refreshDatabase` to run at the top of every hour. That job deletes all documents in the six application collections and repopulates them from the JSON files in `server/data`. Changes made through the API are therefore temporary and will be discarded on the next run. Disable or replace this scheduled reset before using a persistent or production Atlas database.