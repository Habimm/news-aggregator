import axios from 'axios';
import cheerio from 'cheerio';
import React, { useEffect, useState } from "react";
import { Configuration, OpenAIApi } from 'openai';

async function fetchLinks(numberOfLinks) {
    const url = 'https://www.tagesschau.de';
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const links = [];

    $('a.teaser__link').each((i, link) => {
        if (links.length < numberOfLinks) {
          const href = $(link).attr('href');
          links.push(url + href);
        }
    });

    return links;
}

async function getArticle(url) {
  let newsText = [];

  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  const ancestor = $('article.container.content-wrapper__group');

  const classes = ['seitenkopf__headline', 'meldung__subhead', 'textabsatz', 'tag-btn'];

  ancestor.find('h1, h2, p, a').each((i, element) => {
    const elClass = $(element).attr('class') || '';
    if(classes.some(cls => elClass.includes(cls))) {
      newsText.push($(element).text().trim());
    }
  });

  ancestor.find('p, h2').each(() => {
    newsText.push('');
  });

  return newsText.join('\n');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function App() {
  const [articles, setArticles] = useState([]);
  const [summaries, setSummaries] = useState([]);

  useEffect(() => {
    const fetchArticles = async () => {
      const links = await fetchLinks(5);
      const fetchedArticles = [];
      const computedSummaries = [];

      for (const link of links) {
        const article = await getArticle(link);
        fetchedArticles.push(article);
        setArticles(fetchedArticles);

        const configuration = new Configuration({
          apiKey: process.env.REACT_APP_OPENAI_API_KEY,
        });
        const openai = new OpenAIApi(configuration);
        const articleWithPrompt = `
          FASSE IN EINEM EINZIGEN SATZ FÜR EINEN 12-JÄHRIGEN ZUSAMMEN. MIT HÖCHSTENS 25 WORTEN!

          ${article}
        `;

        // const response = {
        //   data: {
        //     choices: [
        //       {
        //         message: {
        //           content: '123',
        //         },
        //       },
        //     ],
        //   },
        // };
        await delay(60000);
        const response = await openai.createChatCompletion({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: articleWithPrompt }],
        });

        const computedSummary = response.data.choices[0].message.content;
        computedSummaries.push(computedSummary);
        setSummaries(computedSummaries);
      }
    };

    fetchArticles();
  }, []);


  return (
    <div className="App">
      <header className="App-header">
        <h1>Neuigkeiten in KURZ</h1>
        <p>{summaries}</p>
        <br />
        <pre>{articles}</pre>
      </header>
    </div>
  );
}

export default App;
