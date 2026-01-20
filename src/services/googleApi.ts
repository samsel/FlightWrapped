import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { Store } from "@tauri-apps/plugin-store";

const STORE_PATH = "store.bin";
let store: Store | null = null;

const getStore = async () => {
    if (!store) {
        store = await Store.load(STORE_PATH);
    }
    return store;
};

export interface AuthResult {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
}

export const signIn = async (): Promise<AuthResult> => {
    const s = await getStore();
    const result = await invoke<AuthResult>("start_google_auth");
    await s.set("access_token", result.access_token);
    if (result.refresh_token) {
        await s.set("refresh_token", result.refresh_token);
    }
    await s.save();
    return result;
};

export const getAccessToken = async (): Promise<string | null> => {
    const s = await getStore();
    const token = await s.get<string>("access_token");
    return token ?? null;
};

export const fetchEmails = async (query: string, pageToken?: string) => {
    const token = await getAccessToken();
    if (!token) throw new Error("No access token");

    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    url.searchParams.append("q", query);
    if (pageToken) {
        url.searchParams.append("pageToken", pageToken);
    }

    const response = await fetch(url.toString(), {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Gmail API error: ${response.statusText}`);
    }

    return response.json();
};

export const fetchEmailDetails = async (id: string) => {
    const token = await getAccessToken();
    if (!token) throw new Error("No access token");

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Gmail API error: ${response.statusText}`);
    }

    return response.json();
};
