import { Fragment, useState } from "react"

function Detial({ content, activte }) {
  return (
    <Fragment>
      <p>{content}</p>
      <p>状态：{activte ? '显示' : '未显示'}</p>
    </Fragment>
  )
}

function Article({ tittle, articalData }) {
  return (
    <div>
      <h2>{tittle}</h2>
      <Detial {...articalData} />
    </div>

  )
}

function App() {
  // const divContent = "标签" //标签内容
  // const divTitle = "标题" //鼠标悬浮标签的内容
  // let [content, setContent] = useState("默认值")
  const list = [
    { id: 1, name: 'jack' },
    { id: 2, name: 'luke' },
    { id: 3, name: 'bob' },
  ]

  let [data, setData] = useState(
    {
      tittle: "默认标题",
      content: "默认值"
    }
  )// 这里，useState中为data的值，setData为修改值的方法



  const listComponet = list.map(item =>
    <Fragment>
      <li>{item.name}</li>
      <li>-------------</li>
    </Fragment>

  )

  function handleClick(e) {
    console.log("click!", e)
    setData(
      {
        ...data,
        content: "新值"
        // tittle: "新标题", 
        // content: "新值"
      }
    )
  }// setData(list.filter(item=>item.id!==2))

  const articalData = {
    tittle: '文章标题',
    detialData: {
      content: '文章内容',
      activte: true,
    }

  }

  return (
    <>
      <div className="App" title={data.tittle}>
        {data.content}
      </div>
      <ul>
        {listComponet}
      </ul>
      <button onClick={handleClick}>按钮</button>
      <Article {...articalData} />
    </>

  );
}

export default App;
