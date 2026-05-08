import axios from 'axios';
import { io } from 'socket.io-client';

const API_BASE_URL = 'http://localhost:3001/api/v1';
const SOCKET_URL = 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

export const executeCode = async (code, language, stdin) => {
  const response = await api.post('/execute', { code, language, stdin });
  return response.data;
};

// Real-time socket connection
export const createExecutionSocket = () => {
  return io(SOCKET_URL);
};
