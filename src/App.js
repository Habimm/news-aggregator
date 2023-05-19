import "./App.css";
import 'bootstrap/dist/css/bootstrap.min.css';
import axios from 'axios';
import cheerio from 'cheerio';
import React, { useEffect, useState, useRef } from "react";

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

async function fetchLink(articles, setArticles, openaiApiKeyRef, promptRef) {
  const baseUrl = 'https://www.tagesschau.de';
  const response = await axios.get(baseUrl);
  const $ = cheerio.load(response.data);

  const teaserLinks = $('a.teaser__link').toArray();

  const href = $(teaserLinks[articles.length]).attr('href');
  var fullLink = (href.startsWith('http')) ? href : baseUrl + href;
  console.log(fullLink)

  // Fetch additional data for this link
  const articleResponse = await axios.get(fullLink);
  const article$ = cheerio.load(articleResponse.data);

  const imageSrc = article$('img.ts-image').attr('src');
  const date = article$('p.metatextline').text();

  var article = {
    url: fullLink,
    imageSrc: imageSrc,
    date: date,
    summary: null,
  };

  const newArticles = [...articles, article];
  summarizeArticle(newArticles, setArticles, openaiApiKeyRef, promptRef);

  return article;
}

const summarizeArticle = async (articles, setArticles, openaiApiKeyRef, promptRef) => {
  for (let index = 0; index < articles.length; index++) {
    var article = articles[index];
    console.log(article);

    if (article.summary) {
      console.log("Already summarized article!");
      continue;
    }

    const openaiApiKey = openaiApiKeyRef.current.value;
    const prompt = promptRef.current.value;

    console.log("OpenAI API Key:", openaiApiKey);
    console.log("Prompt:", prompt);

    var articleUrl = article['url'];
    var articleText = await getArticleText(articleUrl);
    articleText = articleText.trim();
    articleText = articleText.substring(0, 5500);

    let articleWithPrompt = prompt;
    articleWithPrompt += "\n\n";
    articleWithPrompt += articleText;

    // The newline at the end of the prompt is ESSENTIAL. Without it, the model might ignore the prompt
    // at the beginning of the user content's message and just complete the last sentence
    // in the scraped article.
    articleWithPrompt += "\n";

    try {
      const openaiBody = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: articleWithPrompt }],
      };
      console.log(openaiBody);

      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      };

      const response = await axios.post("https://api.openai.com/v1/chat/completions", openaiBody, {headers: headers});
      const computedSummary = response.data.choices[0].message.content;

      const newArticles = [...articles];
      newArticles[index]['summary'] = computedSummary;
      setArticles(newArticles);

      break;
    } catch (error) {
      console.error(`An error occurred during the API call: ${error}`);
      break;
    }
  }

  console.log("ALL DONE.")
};

function App() {
  var stuffFromLocalStorage = JSON.parse(localStorage.getItem('articles')) || [];
  const [articles, setArticles] = useState(stuffFromLocalStorage);
  const openaiApiKeyRef = useRef(null);
  const promptRef = useRef(null);

  useEffect(() => {
    console.log(articles);
    localStorage.setItem('articles', JSON.stringify(articles));
  }, [articles]);

  return (
    <div className="App night-sky-background">
      <button type="button" className="btn btn-danger" onClick={() => fetchLink(articles, setArticles, openaiApiKeyRef, promptRef)}>
        Add article
      </button>

      <div className="container">
        <div className="row">
          <div className="col">
            <div className="form-group">
              <label htmlFor="openaiApiKey" className="custom-label">OpenAI API Key</label>
              <input type="text" className="form-control" id="openaiApiKey" placeholder="sk-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuv" ref={openaiApiKeyRef} />
            </div>
          </div>
          <div className="col">
            <div className="form-group">
              <label htmlFor="prompt" className="custom-label">Prompt</label>
              <input type="text" className="form-control" id="prompt" placeholder="FASSE IN EINEM EINZIGEN SATZ FÜR EINEN 12-JÄHRIGEN ZUSAMMEN. MIT HÖCHSTENS 25 WORTEN!" ref={promptRef} />
            </div>
          </div>
        </div>
      </div>

      {articles.map((article, articleIndex) => (
        <div key={articleIndex} className="card text-center" style={{margin: "90px"}}>
          <div className="row no-gutters">
            <div className="col-md-4">
              <img src={article.imageSrc} className="card-img" alt="..." style={{margin: "20px"}} />
            </div>
            <div className="col-md-8">
              <div className="card-body">
                <p className="card-text">{article.summary}</p>
                <p className="card-text"><a href={article.url} target="_blank" rel="noopener noreferrer" className="card-text">Full text</a></p>
                <p className="card-footer text-muted" style={{"marginTop": "15%"}}>{article.date}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default App;
