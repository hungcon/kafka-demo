/* eslint-disable func-names */
/* eslint-disable prefer-const */
const Article = require('../../../models/article');
const Audio = require('../../../models/audio');
const InvalidArticle = require('../../../models/invalidArticle');
const Website = require('../../../models/website');
const Category = require('../../../models/category');
const Sentence = require('../../../models/sentence');
const {
  getAllophones,
  splitSentences,
  getAudioSentenceLink,
  getNormalizeWord,
} = require('../../ttsengine');

const { concatByLink } = require('../../audio/join_audio');

const getValidArticles = async (website, category, date, status) => {
  let articles;
  const condition = {};
  if (website) {
    condition.website = (await Website.findOne({ name: website }))._id;
  }
  if (category) {
    condition.category = (await Category.findOne({ name: category }))._id;
  }
  if (date.startDate) {
    condition.createdAt = {
      $gte: new Date(date.startDate).toISOString(),
      $lte: new Date(date.endDate).toISOString(),
    };
  }
  if (status) {
    condition.status = status;
  }
  console.log(condition);
  articles = await Article.find(condition)
    .populate({
      path: 'website',
      model: Website,
    })
    .populate({
      path: 'category',
      model: Category,
    });
  return articles;
};

const getValidArticleById = async (articleId) => {
  const article = await Article.findOne({ _id: articleId }).populate({
    path: 'sentences',
    model: Sentence,
    options: {
      sort: { sentenceId: 1 },
    },
  });
  return article;
};

const isCategoryAdded = async (link, title, category) => {
  const article = await Article.findOne({
    $or: [{ link }, { title }],
  });
  const listCategory = article.category;
  const isAdded = listCategory.some(
    (categoryInDb) => categoryInDb === category._id,
  );
  return isAdded;
};

const updateValidArticle = async (link, title, text, id) => {
  const updateResult = await Article.findOneAndUpdate(
    { _id: id },
    {
      $set: {
        link,
        title,
        text,
      },
    },
  );
  return updateResult;
};

const deleteValidArticle = async (id) => {
  await Article.findOneAndDelete({ _id: id });
  return { status: 1 };
};

const updateCategory = async (link, title, category) => {
  const update = await Article.findOneAndUpdate(
    {
      $or: [{ title }, { link }],
    },
    {
      $push: { category },
    },
  );
  return update;
};

const updateStatus = async (articleId) => {
  const update = await Article.findOneAndUpdate(
    { _id: articleId },
    { $set: { status: 4 } },
  );
  return update;
};

const insertArticle = async (article) => {
  const newArticle = await Article.create(article);
  return newArticle;
};

const addValidArticle = async (article) => {
  const newArticle = await Article.create(article);
  await InvalidArticle.findOneAndDelete({
    title: article.title,
  });
  return newArticle;
};

const isExistedInArticle = async (link, title) => {
  const article = await Article.findOne({
    $or: [{ link }, { title }],
  });
  return !!article;
};

const cleanArticle = async (articleId) => {
  const article = await Article.findOne({ _id: articleId });
  const { message } = await splitSentences(article.text);
  const listSentences = JSON.parse(message);
  // save sentences
  for (let i = 0; i < listSentences.length; i += 1) {
    await getAllophones(listSentences[i], articleId, i);
  }
  setTimeout(async function () {
    await checkCallbackAllophones(articleId, listSentences.length);
  }, 2 * 60 * 1000);
  return { status: 1 };
};

const checkCallbackAllophones = async (articleId, numberOfSentences) => {
  // Nếu đã lưu được số câu (số câu đã call_back về) = số câu gửi đi thì đánh dấu thành công
  const article = await Article.findOne({ _id: articleId });
  if (article.sentences.length === numberOfSentences) {
    await Article.findOneAndUpdate({ _id: articleId }, { status: 3 });
    console.log('Chuyển trạng thái thành đã chuẩn hoá máy');
  } else {
    await Sentence.deleteMany({
      _id: {
        $in: cleanArticle.sentences,
      },
    });
    await Article.findOneAndUpdate(
      { _id: articleId },
      { status: 2, sentences: [] },
    );
    console.log('Chuyển trạng thái thành chuẩn hoá máy lỗi');
  }
  return { status: 1 };
};

const syntheticArticle = async (articleId, voiceSelect) => {
  const article = await Article.findOne({ _id: articleId }).populate({
    path: 'sentences',
    model: Sentence,
    options: {
      sort: { sentenceId: 1 },
    },
  });
  if (article.status === 2) {
    return { status: 0 };
  }
  await Article.findOneAndUpdate({ _id: articleId }, { status: 6 });
  const listSentences = article.sentences;
  for (let i = 0; i < listSentences.length; i += 1) {
    await getAudioSentenceLink(
      listSentences[i].allophones,
      articleId,
      listSentences[i].sentenceId,
      voiceSelect,
    );
  }
  setTimeout(async function () {
    await checkCallbackAudio(listSentences.length, articleId);
  }, 2 * 60 * 1000);
  return { status: 1 };
};

const checkCallbackAudio = async (numberOfSentences, articleId) => {
  const listAudioUrl = await Audio.find({ articleId });
  if (listAudioUrl.length !== numberOfSentences) {
    console.log(`Tổng hợp lỗi:  ${articleId}`);
    await Article.findOneAndUpdate({ _id: articleId }, { status: 7 });
    await Audio.deleteMany({ articleId });
    return { status: 0 };
  }
  listAudioUrl.sort(function (a, b) {
    return a.sentenceId - b.sentenceId;
  });
  const links = [];
  for (const audioLink of listAudioUrl) {
    links.push(audioLink.link);
  }
  const filePath = await concatByLink({ links, articleId });
  await Article.findOneAndUpdate({ _id: articleId }, { status: 8 });
  console.log('Chuyển trạng thái bài báo sang đã chuyển audio');
  await Article.findOneAndUpdate(
    { _id: articleId },
    { $set: { linkAudio: filePath } },
  );
  await Audio.deleteMany({ articleId });
  return { status: 1 };
};

const normalizeWord = async (listExpansionChange, articleId) => {
  for (const expansionChange of listExpansionChange) {
    const { id, expansion, index, word, type } = expansionChange;
    await getNormalizeWord(id, expansion, index, word, type);
  }
  await Article.findOneAndUpdate({ _id: articleId }, { $set: { status: 4 } });
  console.log('Chuyển trạng thái bài báo sang đang chuẩn hoá tay');
  return { status: 1 };
};

const finishNormalize = async (articleId) => {
  await Article.findOneAndUpdate({ _id: articleId }, { $set: { status: 5 } });
  console.log('Chuyển trạng thái bài báo sang đã chuẩn hoá tay');
  return { status: 1 };
};

module.exports = {
  getValidArticles,
  updateValidArticle,
  isCategoryAdded,
  updateStatus,
  deleteValidArticle,
  getValidArticleById,
  updateCategory,
  insertArticle,
  addValidArticle,
  isExistedInArticle,
  normalizeWord,
  syntheticArticle,
  finishNormalize,
  cleanArticle,
};
