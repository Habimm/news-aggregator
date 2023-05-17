import axios from 'axios';
import cheerio from 'cheerio';
import React, { useEffect, useState } from "react";
import { Configuration, OpenAIApi } from 'openai';

async function fetchLinks() {
    const url = 'https://www.tagesschau.de'; // replace with your URL
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const links = [];

    $('a.teaser__link').each((i, link) => {
        const href = $(link).attr('href');
        links.push(url + href);
    });

    return links;
}

fetchLinks()
    .then(links => console.log(links))
    .catch(err => console.error(err));

async function getArticle(url) {
  const url = 'https://www.tagesschau.de/inland/urteil-gruenes-gewoelbe-100.html';
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

function App() {
  const [article, setArticle] = useState('');
  const [responseContent, setResponseContent] = useState('');

  useEffect(() => {
    const fetchArticle = async () => {
      const url = 'https://www.tagesschau.de/inland/urteil-gruenes-gewoelbe-100.html';
      const homeNeuigkeitGesamttext = await getArticle(url);
      setArticle(homeNeuigkeitGesamttext);
      fetchData(homeNeuigkeitGesamttext);
    };

    fetchArticle();
  }, []);

  const fetchData = async (article) => {
    const configuration = new Configuration({
      apiKey: process.env.REACT_APP_OPENAI_API_KEY,
    });

    const openai = new OpenAIApi(configuration);

    const articleWithPrompt = `
      FASSE IN EINEM EINZIGEN SATZ FÜR EINEN 12-JÄHRIGEN ZUSAMMEN. MIT HÖCHSTENS 25 WORTEN!

      ${article}
    `;

    const response = {
      data: {
        choices: [
          {
            message: {
              content: '123',
            },
          },
        ],
      },
    };
    // const response = await openai.createChatCompletion({
    //   model: 'gpt-3.5-turbo',
    //   messages: [{ role: 'user', content: articleWithPrompt }],
    // });

    const content = response.data.choices[0].message.content;
    setResponseContent(content);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>OpenAI Integration</h1>
        <p>{responseContent}</p>
        <br />
        <pre>{article}</pre>
        <div className="container">
          <div className="row">
            <div className="col-md-6">
              <h1>Hello</h1>
            </div>
            <div className="col-md-6">
              <p>World</p>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}

export default App;
