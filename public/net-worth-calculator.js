const form=document.querySelector('#calculator');
const result=document.querySelector('#result');
const format=new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0});
const number=value=>Number(String(value).replace(/[^0-9-]/g,''))||0;
if(form&&result){
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const data=new FormData(form);
    const value=number(data.get('cash'))+number(data.get('investments'))+number(data.get('assets'))-number(data.get('debt'));
    result.hidden=false;
    result.textContent=`Perkiraan net worth: ${format.format(value)}`;
  });
  form.querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>{input.value=input.value.replace(/[^0-9]/g,'');}));
}
