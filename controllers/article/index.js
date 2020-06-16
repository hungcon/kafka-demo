const articleService = require('../../services/article');

const getAllophones = async (req, res) => {
  const { message } = req.body;
  const { articleId, sentenceId } = req.query;

  const status = await articleService.storeAllophones(
    message,
    articleId,
    sentenceId,
  );
  return res.send(status);
};

const getAllophonesOfWords = async (req, res) => {
  const { message } = req.body;
  const { sentenceId, orig, type, index } = req.query;
  const status = await articleService.replaceAllophones(
    message,
    sentenceId,
    orig,
    type,
    index,
  );
  return res.send(status);
};

const getAudioUrl = async (req, res) => {
  const { link } = req.body;
  const { articleId, sentenceId } = req.query;
  const status = await articleService.saveAudioUrl(link, sentenceId, articleId);
  return res.send(status);
};

module.exports = {
  getAllophones,
  getAllophonesOfWords,
  getAudioUrl,
};
