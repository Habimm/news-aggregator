import "./App.css";
import "bootstrap/dist/js/bootstrap.bundle.min";
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

async function addArticle(articles, setArticles, openaiApiKeyRef, promptRef) {
  const baseUrl = 'https://www.tagesschau.de';
  const response = await axios.get(baseUrl);
  const $ = cheerio.load(response.data);

  const teaserLinks = $('a.teaser__link').toArray();

  const href = $(teaserLinks[articles.length]).attr('href');
  var fullLink = (href.startsWith('http')) ? href : baseUrl + href;

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

  // Summarize the article's text, or do whatever the prompt says.

  const openaiApiKey = openaiApiKeyRef.current.value;
  const prompt = promptRef.current.value;

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
    console.log("Sent to OpenAI:");
    console.log(openaiBody);

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiApiKey}`,
    };

    const response = await axios.post("https://api.openai.com/v1/chat/completions", openaiBody, {headers: headers});
    const computedSummary = response.data.choices[0].message.content;

    article['summary'] = computedSummary;
    const newArticles = [...articles, article];
    setArticles(newArticles);

  } catch (error) {
    console.error(`An error occurred during the API call: ${error}`);
    window.alert(`An error occurred. Could the OpenAI API Key be incorrect?\nError: ${error}`);
  }

  return article;
}

function App() {
  var stuffFromLocalStorage = JSON.parse(localStorage.getItem('articles')) || [];
  const [articles, setArticles] = useState(stuffFromLocalStorage);
  const openaiApiKeyRef = useRef(null);
  const promptRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('articles', JSON.stringify(articles));
  }, [articles]);

  const handleDefaultPromptClick = (promptOption) => {
    promptRef.current.value = promptOption;
  };

  return (
    <div className="App night-sky-background">
      <button
        type="button"
        className="btn btn-danger plus-button btn-lg"
        onClick={() => addArticle(articles, setArticles, openaiApiKeyRef, promptRef)}
      >
        Add article ➕
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
              <div className="row">
                <div className="form-group">
                  <label htmlFor="prompt" className="custom-label">Prompt</label>
                  <input type="text" className="form-control" id="prompt" ref={promptRef} />
                </div>
                <div className="col">
                  <div className="dropdown">
                    <button className="btn btn-primary dropdown-toggle" type="button" id="dropdownMenuButton" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                      Select Prompt
                    </button>
                    <div className="dropdown-menu" aria-labelledby="dropdownMenuButton">
                      <a className="dropdown-item" href="#" onClick={() => handleDefaultPromptClick("FASSE IN EINEM EINZIGEN SATZ FÜR EINEN 12-JÄHRIGEN ZUSAMMEN. MIT HÖCHSTENS 25 WORTEN!")}>FASSE IN EINEM EINZIGEN SATZ FÜR EINEN 12-JÄHRIGEN ZUSAMMEN. MIT HÖCHSTENS 25 WORTEN!</a>
                      <a className="dropdown-item" href="#" onClick={() => handleDefaultPromptClick("summarize this for a five-year old. keep it funny and teach the five-year old valuable life lessons related to the news.")}>summarize this for a five-year old. keep it funny and teach the five-year old valuable life lessons related to the news.</a>
                      <a className="dropdown-item" href="#" onClick={() => handleDefaultPromptClick("Summarize in one word:")}>Summarize in one word:</a>
                    </div>
                  </div>
                </div>
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
