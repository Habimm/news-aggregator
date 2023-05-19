import 'bootstrap/dist/css/bootstrap.min.css';
import axios from 'axios';
import cheerio from 'cheerio';
import React, { useEffect, useState } from "react";

async function fetchLinks(numberOfLinks) {
  const baseUrl = 'https://www.nytimes.com/';
  const corsProxyUrl = 'https://thingproxy.freeboard.io/fetch/';
  const baseUrlWithCorsHeaders = `${corsProxyUrl}${baseUrl}`;

  let retries = 10;
  var response = null;
  for(let i = 0; i < retries; i++) {
      try {
          response = await axios.get(baseUrlWithCorsHeaders);
          console.log(response.data); // or do whatever you need with the response
          break;
      } catch(err) {
          console.error(`Attempt ${i+1} failed - retrying...`);
      }
  }

  const $ = cheerio.load(response.data);

  const storyLinks = $('section.story-wrapper a').toArray();
  const articles = [];

  for (let i = 0; i < numberOfLinks && i < storyLinks.length; i++) {
    const href = $(storyLinks[i]).attr('href');
    var fullLink = (href.startsWith('http')) ? href : baseUrl + href;
    fullLink = `${corsProxyUrl}${fullLink}`;

    // Fetch additional data for this link
    let retries = 10;
    var articleResponse = null;
    for(let i = 0; i < retries; i++) {
        try {
            articleResponse = await axios.get(fullLink);
            console.log(response.data); // or do whatever you need with the response
            break;
        } catch(err) {
            console.error(`Attempt ${i+1} failed - retrying...`);
        }
    }

    const article$ = cheerio.load(articleResponse.data);

    const title = article$('h1').text();  // Change this line based on the actual CSS selector for the title
    const date = article$('time').attr('datetime');  // Change this line based on the actual CSS selector for the date

    articles.push({
      url: fullLink,
      title: title,
      date: date,
    });
  }

  return articles;
}

async function getArticleText(articleUrl) {
  let newsText = [];

  let retries = 10;

  var response = null;
  for(let i = 0; i < retries; i++) {
      try {
          response = await axios.get(articleUrl);
          break;
      } catch(err) {
          console.error(`Attempt ${i+1} failed - retrying...`);
      }
  }

  const $ = cheerio.load(response.data);

  const h1Text = $('h1[data-testid="headline"]').text().trim();
  newsText.push(h1Text);

  const pText = $('p#article-summary').text().trim();
  newsText.push(pText);

  $('.StoryBodyCompanionColumn').each((i, element) => {
    newsText.push($(element).text().trim());
  });

  var wholeNewsText = newsText.join('\n');

  return wholeNewsText;
}

const fetchArticles = async (setArticles) => {
  const fetchedArticles = await fetchLinks(5);
  const newArticles = [...fetchedArticles];
  setArticles(newArticles);
}

const summarizeArticle = async (articles, setArticles) => {
  for (let index = 0; index < articles.length; index++) {
    var article = articles[index];
    console.log(article);

    if (article.summary) {
      console.log("Already summarized article!");
      continue;
    }

    var articleUrl = article['url'];
    var articleText = await getArticleText(articleUrl);
    articleText = articleText.trim();
    articleText = articleText.substring(0, 5500);

    let articleWithPrompt = "FASSE IN EINEM EINZIGEN SATZ FÜR EINEN 12-JÄHRIGEN ZUSAMMEN. MIT HÖCHSTENS 25 WORTEN!";
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
        "Authorization": `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
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

  useEffect(() => {
    console.log(articles);
    localStorage.setItem('articles', JSON.stringify(articles));
  }, [articles]);

  return (
    <div className="App">
      <button type="button" className="btn btn-primary" onClick={() => summarizeArticle(articles, setArticles)}>
        Summarize article
      </button>
      <button type="button" className="btn btn-danger" onClick={() => fetchArticles(setArticles)}>
        Fetch articles
      </button>
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
