export interface User {
  id: number;
  phone_number: string;
  name: string;
  about?: string;
  avatar_url?: string;
  last_seen?: string;
  created_at: string;
}

export interface Chat {
  id: number;
  type: "private" | "group";
  created_by: number;
  name?: string;
  avatar_url?: string;
  created_at: string;
  members?: ChatMember[];
  messages?: Message[];
}

export interface ChatMember {
  id: number;
  chat_id: number;
  user_id: number;
  role: "member" | "admin" | "owner";
  joined_at: string;
  last_read_msg_id?: number;
  user?: User;
}

export interface Message {
  id: number;
  chat_id: number;
  sender_id: number;
  type: "text" | "image" | "video" | "audio" | "file" | "location" | "system";
  text?: string;
  file_url?: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
  updated_at?: string;
  is_deleted: boolean;
  sender?: User;
  status?: MsgStatus[];
}

export interface MsgStatus {
  id: number;
  msg_id: number;
  user_id: number;
  status: "sent" | "delivered" | "read";
  updated_at: string;
}

export interface WSMessage {
  type: "message" | "typing" | "presence" | "read_receipt";
  chat_id?: number;
  user_id?: number;
  data?: any;
  timestamp: string;
}

export interface CreateChatRequest {
  type: "private" | "group";
  user_ids: number[];
  name?: string;
  avatar_url?: string;
}

export interface SendMessageRequest {
  chat_id: number;
  type: "text" | "image" | "video" | "audio" | "file" | "location";
  text?: string;
  file_url?: string;
  latitude?: number;
  longitude?: number;
}

export interface UpdateReadStatusRequest {
  chat_id: number;
  last_read_msg_id: number;
}

