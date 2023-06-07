import PrismaClient from '@wasp/dbClient';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { Document } from 'langchain/document';
import { User } from '@wasp/entities';
import type { Vector } from '@pinecone-database/pinecone';
import { PineconeClient } from '@pinecone-database/pinecone';
import fs from 'fs';
import path from 'path';

/**
 * this must be the same name you'll use to log into the app with
 */
const NAME_SPACE = 'hot_town';
/**
 * !! don't change this directory! You can replace the notes.txt file with your own though
 */
const SHARED_DIR = './src/shared/docs';

const pinecone = new PineconeClient();
export const initPinecone = async () => {
  await pinecone.init({
    environment: process.env.PINECONE_ENV!,
    apiKey: process.env.PINECONE_API_KEY!,
  });
  return pinecone;
};

const embeddings = new OpenAIEmbeddings({
  // stripNewLines: false,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

/**
 * we export this function and define it in our main.wasp config file
 * so that we can run it from the command line with `wasp db seed`
 */
export const embedNotes = async (prismaClient: typeof PrismaClient) => {
  const pinecone = await initPinecone();

  console.log('list indexes', await pinecone.listIndexes());

  if (!(await pinecone.listIndexes()).includes('embeds-test')) {
    console.log('creating index');
    await pinecone.createIndex({
      createRequest: {
        name: 'embeds-test',
        dimension: 1536,
      },
    });
  }
  const pineconeIndex = pinecone.Index('embeds-test');

  const vectorStore = new PineconeStore(embeddings, {
    pineconeIndex: pineconeIndex,
    namespace: NAME_SPACE,
  });

  const filePath = path.join(SHARED_DIR, 'notes.txt');
  const file = fs.readFileSync(filePath, 'utf-8');

  const docs: Document[] = [];

  file.split('\n').forEach((line) => {
    // remove all dashes that are not directly followed by a letter
    line = line.replace(/-(?![a-zA-Z])/g, '');
    line = line.replace(/"/g, '');
    line = line.replace(/{/g, '');
    line = line.replace(/}/g, '');
    line = line.trim();
    // check if last character is a period and if not add one
    if (line[line.length - 1] !== '.') {
      line += '.';
    }
    line += '\n'

    const doc = new Document({
      metadata: { type: 'note' },
      pageContent: line,
    })
    
    docs.push(doc);
  });
  
  // const docs = [
  //   new Document({
  //     metadata: { type: 'note' },
  //     pageContent:
  //       "I'm pro remote work in small-to-medium sized cities. Remote work in a smaller city means lower living costs, better access to nature, close-knit community, and less time spent commuting or getting around",
  //   }),
  //   new Document({
  //     metadata: { type: 'note' },
  //     pageContent:
  //       'A good personal moat is being psyched about something you accomplished without caring about the results.',
  //   }),
  //   new Document({
  //     metadata: { type: 'note' },
  //     pageContent:
  //       'I’m not sure there’s any 10 step method to creativity. Seems to me it’s more about stepping back than leaning in. Allowing yourself to get distracted by weird ideas, exploring random new things, trying stuff out and being a constant n00b.',
  //   }),
  //   new Document({
  //     metadata: { type: 'tweet' },
  //     pageContent: 'I am an old man and have known a great many troubles, but most of them never happened.',
  //   }),
  // ];

  console.log('docs', docs);

  // const array = docs.map((doc) => doc.pageContent);
  // const embeddingsArray = await embeddings.embedDocuments(array)

  await vectorStore.addDocuments(docs);
  console.log('success!')
  // await PineconeStore.fromDocuments(docs, embeddings, {
  //   pineconeIndex: pineconeIndex,
  //   namespace: NAME_SPACE
  // });
};
