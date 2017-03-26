import MarkovChain from 'markovchain';
import fs from 'fs';
import _ from 'lodash';
import WordPOS from 'wordpos';
import Twit from 'twit';
import TwitterBot from 'node-twitterbot';

const { TwitterBot: NodeTwitterBot } = TwitterBot;

const Bot = new NodeTwitterBot({
 consumer_key: process.env.BOT_CONSUMER_KEY,
 consumer_secret: process.env.BOT_CONSUMER_SECRET,
 access_token: process.env.BOT_ACCESS_TOKEN,
 access_token_secret: process.env.BOT_ACCESS_TOKEN_SECRET,
});

const wordpos = new WordPOS();

// IDEAS
//
// Hashtag generators — not just making single words hashtags, but making random multi-word ones from phrases for the ends of tweets, e.g. #ToBeOrNotToBe
//
// Meme structures:
// Me:, Evil me: (kermit pic)
// TFW
// but that's none of my business

const text = fs.readFileSync('./words.txt', 'utf8');

const markovChain = new MarkovChain(text);
const textSplitBySpace = text.split(' ');

const ALLOWED_EMOJI = [
  '🙏', '❤️', '👀', '👌', '😍', '🌈', '😎', '🔥', '✨',
  '⚡️', '😂', '🙃', '😏', '😘', '🙂', '😱', '💅', '💁',
];

const DISALLOWED_HASHTAG_WORDS = [
  'in', 'on', 'or', 'about', 'an', 'a', 'i',
  'be', 'is', 'am', 'are', 'do', 'does', 'go',
  'as', 'no', 'there', 'i\'ll', 'he', 'she', 'they',
  'have', 'may', 'at', 'so', 'here', 'it', 'out', 'much', 'o\'',
  'like', 'out', 'such',
];

const getSingleEmoji = () => ALLOWED_EMOJI[randomNumber(0, ALLOWED_EMOJI.length)];
const randomNumber = (min, max) => Math.floor(Math.random() * max) + min;
const isCharLetter = (character) => character.match(/[a-z]/gi);
const isAllowedHashtag = (word) => !_.includes(DISALLOWED_HASHTAG_WORDS, _.lowerFirst(word));
const chanceToAddHashtag = (word) => Math.random() < 0.25 && isAllowedHashtag(word) ? `#${ word }` : word;
const makeHashTags = (number) => [...Array(number)].map(() => makeHashTag()).join(' ');

const EMOJI_OPTIONS = {
  none: () => '',
  single: () => ` ${ getSingleEmoji() }`,
  triple: () => {
    const emoji = getSingleEmoji();
    return ` ${ emoji }${ emoji }${ emoji }`;
  },
  two_different: () => ` ${ getSingleEmoji() }${ getSingleEmoji() }`,
};

function isVerbNounAdjectiveOrAdverb(word) {
  const sanitisedWord = word.replace(/[^a-zA-Z]+/g, '');

  return Promise
    .all([
      wordpos.isAdjective(sanitisedWord),
      wordpos.isNoun(sanitisedWord),
      wordpos.isVerb(sanitisedWord),
    ])
    .then((result) => {
      return {
        word,
        isVerbNounAdjectiveOrAdverb: _.some(result),
      };
    });
}

function getRandomEmojiOption() {
  const optionsAsArray = Object.keys(EMOJI_OPTIONS);
  const randomKey = optionsAsArray[randomNumber(0, optionsAsArray.length)];
  return EMOJI_OPTIONS[randomKey]();
}

function getRandomPhrase(minLength, maxLength) {
  const randomPhrase = markovChain
    .start(textSplitBySpace[randomNumber(5, textSplitBySpace.length)])
    .end(maxLength)
    .process();

  return randomPhrase.split(' ').length < minLength
      || randomPhrase.split(' ').length > maxLength ?
        getRandomPhrase(minLength, maxLength) :
        randomPhrase;
}

function addHashTags(phrase) {
  return Promise
    .all(phrase.split(' ').map(isVerbNounAdjectiveOrAdverb))
    .then((result) => {
      return result
        .map((item) => {
          return item.isVerbNounAdjectiveOrAdverb ? chanceToAddHashtag(item.word) : item.word;
        })
        .join(' ');
    });
}

function makeHashTag() {
  const res = getRandomPhrase(3, 5)
    .split(' ')
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join('')
    .replace(/[^a-zA-Z]+/g, '');

  return `#${ res }`;
}

function trimFinalCharIfNotLetter(string) {
  if (isCharLetter(string.slice(-1))) {
    return string;
  } else {
    const newString = string.slice(0, -1);
    return isCharLetter(newString.slice(-1)) ? newString : trimFinalCharIfNotLetter(newString);
  }
}

const makePhrase = () => addHashTags(trimFinalCharIfNotLetter(getRandomPhrase(8, 12)));

function makeTweet() {
  const tweet = makePhrase().then((result) => {
    return `${ result }${ getRandomEmojiOption() } ${ makeHashTags(randomNumber(0, 3)) }`.trim();
  });

  tweet.then((result) => result.length <= 137 ? Bot.tweet(result) : makeTweet());
}

makeTweet();
