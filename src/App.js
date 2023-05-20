import "./App.css";
import "bootstrap/dist/js/bootstrap.bundle.min"; // for the dropdown menu
import 'bootstrap/dist/css/bootstrap.min.css';
import axios from 'axios';
import cheerio from 'cheerio';
import { useEffect, useState, useRef } from "react";

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

async function addArticle(articles, setArticles, promptRef) {
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

  // All of the following code is for
  // summarizing the article's text, or doing whatever the prompt says.

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

  document.body.classList.add("loading");
  try {
    const openaiBody = {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: articleWithPrompt }],
    };

    console.log("Sent to OpenAI:");
    console.log(openaiBody);

    var responseWithSummary = null;
    try {
      // On this local port, you should run the OpenAI forwarder,
      // also introduced at the tutorial on Medium

      responseWithSummary = await axios.post('http://localhost:5000/', openaiBody);

    } catch (error) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error(`Error: ${error.response.data}`);
        if (error.response.status === 401) {
          // Handle 401 error here
          console.error('Unauthorized request. Check your API key inside the OpenAI Forwarder. Then restart the OpenAI Forwarder.');
          window.alert('Unauthorized request. Please check your API key inside the OpenAI Forwarder. Then restart the OpenAI Forwarder.');
        } else {
          // Handle other errors here
          console.error(`Error status: ${error.response.status}`);
          window.alert(`An error occurred. Please check your setup. Status code: ${error.response.status}`);
        }
      } else {
        // The request was made but no response was received
        console.error(`Error in setup: ${error.message}`);
        window.alert(`No key manager found. Please setup the key manager from: https://github.com/Habimm/openai-keymanager`);
      }
    }

    article['summary'] = responseWithSummary.data.choices[0].message.content;
    const newArticles = [...articles, article];
    setArticles(newArticles);

  } catch (error) {
    console.error(`An error occurred during the API call: ${error}`);
  } finally {
    document.body.classList.remove("loading");
  }

  return article;
}

function App() {
  var stuffFromLocalStorage = JSON.parse(localStorage.getItem('articles')) || [];
  const [articles, setArticles] = useState(stuffFromLocalStorage);
  const promptRef = useRef(null);

  useEffect(() => {
    handleDefaultPromptClick("summarize this for a five-year old. keep it funny and teach the five-year old valuable life lessons related to the news.")
  }, []);

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
        onClick={() => addArticle(articles, setArticles, promptRef)}
      >
        Add article ➕
      </button>

      <div className="container">
          <div className="row">
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
                      <button className="dropdown-item" onClick={() => handleDefaultPromptClick("FASSE IN EINEM EINZIGEN SATZ FÜR EINEN 12-JÄHRIGEN ZUSAMMEN. MIT HÖCHSTENS 25 WORTEN!")}>FASSE IN EINEM EINZIGEN SATZ FÜR EINEN 12-JÄHRIGEN ZUSAMMEN. MIT HÖCHSTENS 25 WORTEN!</button>
                      <button className="dropdown-item" onClick={() => handleDefaultPromptClick("summarize this for a five-year old. keep it funny and teach the five-year old valuable life lessons related to the news.")}>summarize this for a five-year old. keep it funny and teach the five-year old valuable life lessons related to the news.</button>
                      <button className="dropdown-item" onClick={() => handleDefaultPromptClick("Summarize in one word:")}>Summarize in one word:</button>
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
