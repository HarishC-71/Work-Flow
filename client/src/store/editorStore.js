import { create } from 'zustand';
import { LANGUAGES } from '../utils/constants';

const useEditorStore = create((set) => ({
  language: 'python',
  code: LANGUAGES.python.defaultCode,
  stdin: '',
  
  setLanguage: (language) => set({
    language,
    code: LANGUAGES[language]?.defaultCode || '',
  }),
  
  setCode: (code) => set({ code }),
  setStdin: (stdin) => set({ stdin }),
  
  loadSnippet: (snippet) => set({
    language: snippet.language,
    code: snippet.code,
    stdin: snippet.stdin || '',
  }),
}));

export default useEditorStore;
