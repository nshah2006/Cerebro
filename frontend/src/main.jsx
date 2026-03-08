import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Auth0Provider } from "@auth0/auth0-react"
import "./index.css"
import App from "./App.jsx"

const domain = import.meta.env.VITE_AUTH0_DOMAIN
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {domain && clientId ? (
      <Auth0Provider
        domain={domain}
        clientId={clientId}
        authorizationParams={{ redirect_uri: window.location.origin }}
        cacheLocation="localstorage"
      >
        <App />
      </Auth0Provider>
    ) : (
      <div style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: "480px" }}>
        <h1>Frontend running</h1>
        <p>Add Auth0 credentials to <code>frontend/.env</code> and restart <code>npm run dev</code>:</p>
        <pre style={{ background: "#f0f0f0", padding: "1rem", borderRadius: "4px" }}>
{`VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id`}
        </pre>
        <p>Then add <strong>http://localhost:5173</strong> to Allowed Callback URLs in your Auth0 app.</p>
      </div>
    )}
  </StrictMode>
)