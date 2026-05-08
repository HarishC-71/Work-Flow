const executionService = require('../services/executionService');

exports.executeCode = async (req, res, next) => {
  try {
    const { code, language, stdin } = req.body;
    
    if (!code || !language) {
      return res.status(400).json({ 
        error: { message: 'Code and language are required' } 
      });
    }

    const result = await executionService.execute(language, code, stdin);
    res.status(200).json(result);
    
  } catch (error) {
    next(error);
  }
};

exports.getExecution = async (req, res, next) => {
  try {
    const { id } = req.params;
    const execution = await executionService.getExecution(id);
    
    if (!execution) {
      return res.status(404).json({ 
        error: { message: 'Execution not found' } 
      });
    }

    res.status(200).json(execution);
  } catch (error) {
    next(error);
  }
};
