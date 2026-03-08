# MongoDB Atlas setup (cluster + connection URL)

Use this guide to create a new cluster, get a connection URL, and allow your friends (or any IP) to connect.

---

## Step 1: Create an Atlas account and cluster

1. Go to **[MongoDB Atlas](https://www.mongodb.com/cloud/atlas)** and sign up or log in.
2. Create an **organization** and **project** if prompted (you can use defaults).
3. Click **Build a Database** (or **Create** → **Cluster**).
4. Choose **M0 FREE** (shared cluster) — no credit card required.
5. Pick a **cloud provider and region** (e.g. AWS, closest to you or your friends).
6. Name the cluster (e.g. `Cluster0`) and click **Create**.

---

## Step 2: Create a database user (for the connection URL)

The connection URL uses a **database user**, not your Atlas login.

1. In the Atlas UI, go to **Database Access** (left sidebar) → **Add New Database User**.
2. Choose **Password** authentication.
3. Set a **username** (e.g. `hackaiuser`) and a **password** (e.g. `MySecurePass123`).
   - **Tip:** Avoid characters like `@`, `#`, `%` in the password so you don’t have to URL-encode them in the URI.
4. Under **Database User Privileges**, choose **Read and write to any database** (or **Atlas admin** for full access).
5. Click **Add User**.

---

## Step 3: Allow network access (so you and your friends can connect)

By default Atlas only allows your current IP. To let anyone (e.g. friends) connect:

1. Go to **Network Access** (left sidebar) → **Add IP Address**.
2. Click **Allow Access from Anywhere**.
   - This adds `0.0.0.0/0` (all IPs). **Good for a shared dev/hackathon project; for production you’d restrict IPs.**
3. Confirm with **Add IP Address**.

(You can add specific IPs later instead of `0.0.0.0/0` if you want to lock it down.)

---

## Step 4: Get the connection URL

1. Go back to **Database** (left sidebar) and open your cluster.
2. Click **Connect** on the cluster.
3. Choose **Drivers** (or “Connect your application”).
4. Pick **Python** and version **3.12 or later**.
5. Copy the connection string. It looks like:
   ```text
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace placeholders:
   - `<username>` → the **database user** you created (e.g. `hackaiuser`).
   - `<password>` → that user’s **password** (the one from Step 2).

**If the password has special characters** (`@`, `#`, `%`, etc.), URL-encode them in the URI:

| Character | Use in URI |
|-----------|------------|
| `@`       | `%40`      |
| `#`       | `%23`      |
| `%`       | `%25`      |
| `:`       | `%3A`      |
| `/`       | `%2F`      |

Example: password `P@ss#123` → in the URI use `P%40ss%23123`.

**Optional:** To use a specific database name in the URL, add it before the `?`:
   ```text
   mongodb+srv://hackaiuser:MyPass123@cluster0.xxxxx.mongodb.net/hackai?retryWrites=true&w=majority
   ```
   (The app also uses `MONGODB_DB_NAME` in `.env` to choose the database; either way works.)

---

## Step 5: Put the URL in your backend `.env`

1. Open **`backend/.env`** (create it if it doesn’t exist).
2. Add or update (single line, no spaces around `=`, no quotes):

   ```env
   MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DB_NAME=hackai
   ```

   Use your real username, password (URL-encoded if needed), and cluster host from Step 4.

3. Save the file and **restart the backend** (`python main.py`).

You should see in the console: **MongoDB connection OK**.

---

## Sharing with friends

- **Same URL:** Give friends the same connection URL (with your database user and password). They put it in their own `backend/.env` as `MONGODB_URI`. With **Network Access → 0.0.0.0/0**, they can connect from anywhere.
- **Security:** For a shared dev/hackathon this is fine. For production, create a separate database user per app, use strong passwords, and restrict IPs in Network Access.

---

# Fixing "bad auth : authentication failed"

The app reaches Atlas (no more SSL errors) but Atlas rejects the username/password in `MONGODB_URI`. Fix it as follows.

---

## 1. Get the connection string from Atlas (correct place)

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com).
2. Go to your **Cluster** → click **Connect**.
3. Choose **Drivers** (or "Connect your application").
4. Copy the connection string. It looks like:
   ```text
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Do **not** use the “MongoDB Shell” or “Compass” connection strings if they look different.

---

## 2. Use the Database User password (not your Atlas login)

- **Database User** = the user you create under **Atlas → Database Access**.
- The password in the URI must be that **Database User’s password**, not the password you use to log in to the Atlas website.

If you’re not sure:

1. In Atlas go to **Database Access**.
2. Find the user you want to use (or create one with “Read and write to any database”).
3. Click **Edit** → **Edit Password**.
4. Set a **new password** (e.g. simple for dev: `MyPass123`).
5. Use this **exact** password in the connection string (and URL-encode it if it has special characters — see below).

---

## 3. Replace placeholders in the URI

In the string you copied:

- Replace `<username>` with your **Database Access** username (e.g. `myuser`).
- Replace `<password>` with that user’s password.

**Important:** If the password contains any of these characters, they **must** be URL-encoded in the URI:

| Character | Replace with |
|-----------|----------------|
| `@`       | `%40`         |
| `#`       | `%23`         |
| `%`       | `%25`         |
| `:`       | `%3A`         |
| `/`       | `%2F`         |
| `?`       | `%3F`         |
| `&`       | `%26`         |
| `=`       | `%3D`         |

Example: password `P@ss#123` → in the URI use `P%40ss%23123`.

---

## 4. Put it in `backend/.env`

In `backend/.env`:

- Use a **single line** for `MONGODB_URI`.
- **No spaces** around `=`.
- **No quotes** around the value (unless your shell requires them; usually not in `.env`).

Example:

```env
MONGODB_URI=mongodb+srv://myuser:P%40ss%23123@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=Cerebro
```

Save the file, then restart the backend: `python main.py`.

---

## 5. Checklist

- [ ] Connection string is from **Connect → Drivers** (or “Connect your application”).
- [ ] `<username>` is the **Database Access** username (not your Atlas account email).
- [ ] `<password>` is that database user’s password (reset it in Database Access if unsure).
- [ ] Any special characters in the password are **URL-encoded** in the URI.
- [ ] No extra spaces or quotes in `MONGODB_URI` in `.env`.
- [ ] In **Network Access**, your IP (or `0.0.0.0/0` for testing) is allowed.

After fixing, restart the backend. You should see: **MongoDB connection OK**.
