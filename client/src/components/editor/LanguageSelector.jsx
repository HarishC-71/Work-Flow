import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import useEditorStore from '../../store/editorStore';
import useExecutionStore from '../../store/executionStore';
import { LANGUAGES } from '../../utils/constants';

export default function LanguageSelector() {
  const { language, setLanguage } = useEditorStore();
  const { reset } = useExecutionStore();
  const langConfig = LANGUAGES[language];

  const handleChange = (e) => {
    setLanguage(e.target.value);
    reset();
  };

  return (
    <div className="relative">
      <select
        value={language}
        onChange={handleChange}
        className="appearance-none bg-bg-tertiary border border-border-default rounded-lg px-3 py-1.5 pr-8 text-xs font-medium text-text-primary cursor-pointer hover:border-accent-primary/50 focus:border-accent-primary focus:outline-none transition-colors"
        style={{ color: langConfig.color }}
      >
        {Object.values(LANGUAGES).map((lang) => (
          <option key={lang.id} value={lang.id}>
            {lang.icon} {lang.name}
          </option>
        ))}
      </select>
      <ChevronDown 
        size={14} 
        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" 
      />
    </div>
  );
}
