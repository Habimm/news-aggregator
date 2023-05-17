import 'bootstrap/dist/css/bootstrap.min.css';
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

const fetchArticles = async (setArticles, setSummaries) => {
  const links = await fetchLinks(5);
  console.log(links)
  const fetchedArticles = [];
  const computedSummaries = [];

  for (const link of links) {
    const article = await getArticle(link);
    fetchedArticles.push(article);
    setArticles(fetchedArticles);
    console.log(fetchedArticles)

    const configuration = new Configuration({
      apiKey: process.env.REACT_APP_OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);
    const articleWithPrompt = `
      FASSE IN EINEM EINZIGEN SATZ FÜR EINEN 12-JÄHRIGEN ZUSAMMEN. MIT HÖCHSTENS 25 WORTEN!

      ${article}
    `;

    while (true) {  // infinite loop, break condition is inside
      try {

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
        const delay = (ms) => {
          return new Promise(resolve => setTimeout(resolve, ms));
        }
        await delay(30000);  // Always wait before trying
        const truncatedArticleWithPrompt = articleWithPrompt.substring(0, 5500);
        const response = await openai.createChatCompletion({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: truncatedArticleWithPrompt }],
        });

        const computedSummary = response.data.choices[0].message.content;
        computedSummaries.push(computedSummary);
        setSummaries(computedSummaries);
        break;  // exit loop if no error
      } catch (error) {
        console.log(error);
      }
    }
  }
};

function App() {
  const [articles, setArticles] = useState([]);
  const [summaries, setSummaries] = useState([]);

  useEffect(() => {
    fetchArticles(setArticles, setSummaries);
  }, []);

  // https://getbootstrap.com/docs/4.3/components/card/
  return (
    <div className="App">
      {summaries.map((summary, summaryIndex) => (
        <div key={summaryIndex} className="card text-center" style={{margin: "90px"}}>
          <div className="row no-gutters">
            <div className="col-md-4">
              <img src="..." className="card-img" alt="..." style={{margin: "20px"}} />
            </div>
            <div className="col-md-8">
              <div className="card-body">
                <p className="card-text">{summary}</p>
                <p className="card-text">
                  <small className="text-muted">17.05.2023 18:16 Uhr</small>
                </p>
              </div>
            </div>
          </div>
        </div>
      ))};
    </div>
  )
}

export default App;
