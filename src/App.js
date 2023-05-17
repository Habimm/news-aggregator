import React, { useEffect, useState } from "react";
import axios from 'axios';
import cheerio from 'cheerio';

async function getArticle() {
  // const url = 'https://www.tagesschau.de/ausland/asien/jemen-buergerkrieg-waffenruhe-baerbock-100.html';
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

  useEffect(() => {
    (async function fetchArticle() {
      const articleText = await getArticle();
      setArticle(articleText);
    })();
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <pre>{article}</pre>
      </header>
    </div>
  );
}

export default App;
