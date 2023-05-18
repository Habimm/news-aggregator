import 'bootstrap/dist/css/bootstrap.min.css';
import axios from 'axios';
import cheerio from 'cheerio';
import React, { useEffect, useState } from "react";
import { Configuration, OpenAIApi } from 'openai';

async function fetchLinks(numberOfLinks) {
  const baseUrl = 'https://www.tagesschau.de';
  const response = await axios.get(baseUrl);
  const $ = cheerio.load(response.data);

  const teaserLinks = $('a.teaser__link').toArray();
  const articles = [];

  for (let i = 0; i < numberOfLinks && i < teaserLinks.length; i++) {
    const href = $(teaserLinks[i]).attr('href');
    const fullLink = baseUrl + href;

    // Fetch additional data for this link
    const articleResponse = await axios.get(fullLink);
    const article$ = cheerio.load(articleResponse.data);

    const imageSrc = article$('img.ts-image').attr('src');
    const date = article$('p.metatextline').text();

    articles.push({
      url: fullLink,
      imageSrc: imageSrc,
      date: date,
      summary: null,
    });
  }

  return articles;
}

async function getArticleText(articleUrl) {
  let newsText = [];

  const response = await axios.get(articleUrl);
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

const fetchArticles = async (setArticles) => {
  const articles = await fetchLinks(5);

  for (const article of articles) {
    if (article.summary) {
      console.log("Already summarized article:");
      console.log(article);
      continue;
    }

    var articleUrl = article['url'];
    const articleText = await getArticleText(articleUrl);

    const configuration = new Configuration({
      apiKey: process.env.REACT_APP_OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);
    const articleWithPrompt = `
      FASSE IN EINEM EINZIGEN SATZ FÜR EINEN 12-JÄHRIGEN ZUSAMMEN. MIT HÖCHSTENS 25 WORTEN!

      ${articleText}
    `;

    const truncatedArticleWithPrompt = articleWithPrompt.substring(0, 5500);
    try {
      const response = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: truncatedArticleWithPrompt }],
      });
      const computedSummary = response.data.choices[0].message.content;
      article['summary'] = computedSummary;
      console.log(articles);
    } catch (error) {
      console.error(`An error occurred during the API call: ${error}`);
      return;
    }
  }

  console.log("ALL DONE.")
};

function App() {
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    fetchArticles(setArticles);
  }, []);

  // https://getbootstrap.com/docs/4.3/components/card/
  return (
    <div className="App">
      <button type="button" className="btn btn-primary">Primary</button>
      {articles.map((article, articleIndex) => (
        <div key={articleIndex} className="card text-center" style={{margin: "90px"}}>
          <div className="row no-gutters">
            <div className="col-md-4">
              <img src="..." className="card-img" alt="..." style={{margin: "20px"}} />
            </div>
            <div className="col-md-8">
              <div className="card-body">
                <p className="card-text">{article}</p>
                <p className="card-text">
                  <small className="text-muted">17.05.2023 18:16 Uhr</small>
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default App;
