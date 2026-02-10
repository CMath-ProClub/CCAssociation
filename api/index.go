package handler

import (
    "encoding/json"
    "net/http"
    "os"
)

type response struct {
    Path   string `json:"path"`
    Method string `json:"method"`
    Env    string `json:"env,omitempty"`
}

// Handler is the Vercel serverless entrypoint.
// It responds with request metadata and can be expanded to call other packages.
func Handler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusOK)

    payload := response{
        Path:   r.URL.Path,
        Method: r.Method,
        Env:    os.Getenv("ENV"),
    }

    _ = json.NewEncoder(w).Encode(payload)
}
