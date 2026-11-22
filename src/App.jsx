import React, { useState, useMemo, useEffect } from 'react';

// Vincenty WGS84
function vincenty(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const a=6378137,f=1/298.257223563,b=(1-f)*a;
  const toRad=d=>d*Math.PI/180;
  const phi1=toRad(lat1),phi2=toRad(lat2),L=toRad(lon2-lon1);
  const U1=Math.atan((1-f)*Math.tan(phi1)),U2=Math.atan((1-f)*Math.tan(phi2));
  const sinU1=Math.sin(U1),cosU1=Math.cos(U1),sinU2=Math.sin(U2),cosU2=Math.cos(U2);
  let lam=L,lamP,iter=100,sinS,cosS,sig,sinA,cos2A,cos2SM;
  do{
    const sinL=Math.sin(lam),cosL=Math.cos(lam);
    sinS=Math.sqrt((cosU2*sinL)**2+(cosU1*sinU2-sinU1*cosU2*cosL)**2);
    if(sinS===0) return 0;
    cosS=sinU1*sinU2+cosU1*cosU2*cosL;
    sig=Math.atan2(sinS,cosS);
    sinA=cosU1*cosU2*sinL/sinS;
    cos2A=1-sinA*sinA;
    cos2SM=cos2A!==0?cosS-2*sinU1*sinU2/cos2A:0;
    const C=f/16*cos2A*(4+f*(4-3*cos2A));
    lamP=lam;
    lam=L+(1-C)*f*sinA*(sig+C*sinS*(cos2SM+C*cosS*(-1+2*cos2SM**2)));
  }while(Math.abs(lam-lamP)>1e-12 && --iter>0);
  if(iter===0) return NaN;
  const u2=cos2A*(a*a-b*b)/(b*b);
  const A=1+u2/16384*(4096+u2*(-768+u2*(320-175*u2)));
  const B=u2/1024*(256+u2*(-128+u2*(74-47*u2)));
  const dSig=B*sinS*(cos2SM+B/4*(cosS*(-1+2*cos2SM**2)-B/6*cos2SM*(-3+4*sinS**2)*(-3+4*cos2SM**2)));
  return Number((b*A*(sig-dSig)).toFixed(1));
}
function gms(lat,lon){
  function toGMS(d,isLat){
    const abs=Math.abs(d),g=Math.floor(abs),m=(abs-g)*60,mi=Math.floor(m),s=((m-mi)*60).toFixed(1);
    const he=isLat?(d>=0?'N':'S'):(d>=0?'E':'W');
    return `${String(g).padStart(2,'0')}-${String(mi).padStart(2,'0')}-${String(s).padStart(4,'0')}${he}`;
  }
  return {lat:toGMS(lat,true),lon:toGMS(lon,false)};
}

export default function SGSP_Completo(){
  const [menu,setMenu]=useState(null);
  const [wins,setWins]=useState(['lancamento','calculo']);
  const [focused,setFocused]=useState('lancamento');
  const open=(id)=>{ setWins(w=> w.includes(id) ? w : [...w,id]); setFocused(id); setMenu(null); };
  const close=(id)=>{ setWins(w=>w.filter(x=>x!==id)); };
  const [msg,setMsg]=useState('Pronto. Movimentos → Lançamento da Prova | Concurso → Pombos Enviados | F9 Cálculo');

  // Base Limeirense
  const [concurso,setConcurso]=useState({ano:2025,num:16,nome:'Brasilia-DF',tipo:'FUNDO',data:'20/09/2025',horaSolta:'06:35:00',lat:'015-42-01.1',lon:'047-48-39.0',enviados:300,tempoMorto:'10:52:00'});
  const [locais]=useState([
    {id:1,nome:'Brasilia-DF',lat:-15.793889,lon:-47.882778},
    {id:2,nome:'Goiania-GO',lat:-16.6869,lon:-49.2648},
    {id:3,nome:'Uberaba-MG',lat:-19.7472,lon:-47.9380},
  ]);
  const [socios,setSocios]=useState([
    {id:1508,nome:'BORDIN & MARQUINHO',lic:'33/1508',lat:-22.5647,lon:-47.4016,ass:'33'},
    {id:81,nome:'VILMAR ALMEIDA PORTA DO SOL',lic:'33/81',lat:-22.5811,lon:-47.4192,ass:'33'},
    {id:283,nome:'GLAUCION CLAITO SILVA',lic:'33/283',lat:-22.7252,lon:-47.6491,ass:'33'},
    {id:91,nome:'EDSON ROBERTO DA SILVA',lic:'33/91',lat:-22.5900,lon:-47.38,ass:'33'},
    {id:1515,nome:'CARLOS ALBERTO DA SILVA',lic:'33/1515',lat:-22.5600,lon:-47.45,ass:'33'},
  ]);
  const [lupaConcurso,setLupaConcurso]=useState(false);
  const [lupaAnilha,setLupaAnilha]=useState(false);
  const handleEnter=(e)=>{
    if(e.key==='Enter'){
      e.preventDefault();
      const focusable=e.currentTarget.closest('form')?.querySelectorAll('input,select,button');
      if(!focusable) return;
      const idx=Array.from(focusable).indexOf(e.target);
      if(idx>=0 && idx<focusable.length-1) focusable[idx+1].focus();
      else if(idx===focusable.length-1) document.activeElement.blur();
    }
  };
  const maskData=(v)=>{
    let d=v.replace(/\D/g,'').slice(0,8);
    if(d.length>4) return d.slice(0,2)+'/'+d.slice(2,4)+'/'+d.slice(4);
    if(d.length>2) return d.slice(0,2)+'/'+d.slice(2);
    return d;
  };
  const maskHora=(v)=>{
    let h=v.replace(/\D/g,'').slice(0,6);
    if(h.length>4) return h.slice(0,2)+':'+h.slice(2,4)+':'+h.slice(4);
    if(h.length>2) return h.slice(0,2)+':'+h.slice(2);
    return h;
  };
  const maskAnilha=(v)=>{
    let a=v.replace(/[^0-9\/]/g,'').replace(/\//g,'').slice(0,9);
    if(a.length>2) return a.slice(0,a.length-2)+'/'+a.slice(-2);
    return a;
  };
  // Lançamento form state (igual print)
  const [form,setForm]=useState({
    concurso:'',anilha:'',sexo:'Macho',assoc:'0',colec:'',concorrente:'',
    dataI:'',horaI:'',dataF:'',horaF:'',correcao:0,
    diasCheg:1,diaCheg:'',partida:'',tempoMorto:'',corr2:0,tempoVoo:'',
    distancia:'',media:'',
    anilhas:true,designados:true,equipas:false,csec:false,feder:false,
  });
  const [anilhasLancadas,setAnilhasLancadas]=useState([
    {anilha:'0084751/20',hora:'17:20:10'},{anilha:'2320071/23',hora:'17:20:12'},{anilha:'2320071/23',hora:'17:22:06'}
  ]);
  // Calculo steps
  const [steps,setSteps]=useState({apagar:false,dist:false,preencher:false,tempo:false,lugares:false,premios:false,coef:false,sec:false});
  const [calcDone,setCalcDone]=useState(false);
  // Classificação
  const [classParams,setClassParams]=useState({comPombos:'Não',melhores:99999,daPag:1,atePag:9999,copias:1,destino:'Impressora',comPremio:'Não',formato:'Tudo',pombosZero:'Não',realcar:0});
  const [expGPB,setExpGPB]=useState({a:'11',b:'33',c:'283',nome:'GLAUCIANO CLAITO SILVA',destino:'Disquete',loc:''});
  const [expTotal,setExpTotal]=useState({ano:'',num:'',destino:'Disquete',loc:''});
  const [classTot,setClassTot]=useState({ano:'',num:'',tipo:'',lat:'',data:'',lon:'',de1:'11',de2:'33',de3:'77',deNome:'RENATO SOARES',ate1:'11',ate2:'33',ate3:'99999',ateNome:'VENERANDO SOARES DA SILVA',tipoSel:'Todos',pombosSel:'Com Classificações',tipoProva:'Oficiais'});
  const [pomboAs,setPomboAs]=useState({ano:'2025',de:'1',ate:'16',categoria:'GERAL',criterio:'Coeficiente',minimo:'3',tipoProva:'Oficiais',destino:'Impressora'});
  const [palmares,setPalmares]=useState({anilha:'0084701/20',ano:'2025',categoria:'GERAL',tipoProva:'Oficiais'});
  const [lupaPalmares,setLupaPalmares]=useState(false);
  const [lupaConcorrente,setLupaConcorrente]=useState(false);
  const [lupaGrupo,setLupaGrupo]=useState(false);
  const [lupaPombosFe,setLupaPombosFe]=useState(false);
  const [lupaTarget,setLupaTarget]=useState(null); // para saber qual campo preencher
  const [concTotais,setConcTotais]=useState({provas:'Oficiais',tipoProva:'Velocidade',espVel:true,espMeio:true,espFundo:true,espGrande:true,titulo:'Classificação de Concorrentes - Velocidade',grupo:'',melhores:'99999',zeroPonto:'Não',desempate:'Não',coeficientes:'Não',retirar:'Não',realcar:'0',destino:'Impressora',daPag:'1',atePag:'9999',copias:'1'});
  const [pombosTotais,setPombosTotais]=useState({provas:'Oficiais',tipoProva:'Velocidade',grupo:'',melhores:'99999',realcar:'0',desempate:'Não',destino:'Impressora',daPag:'1',atePag:'9999',copias:'1'});
  const [pombosFe,setPombosFe]=useState({ano:'2025',num:'16',nome:'Brasilia-DF',tipo:'FUNDO',de:'1',ate:'16',criterio:'Pontos',destino:'Impressora'});
  const [concursoTab,setConcursoTab]=useState('Editar');
  const [concursosLista,setConcursosLista]=useState([
    {ano:'2025',num:'1',nome:'Cravinhos-Sp',data:'08/06/2025',tipo:'Grande Fundo',oficial:'Oficial',latG:'021',latM:'19',latS:'45.0',lonG:'047',lonM:'42',lonS:'58.3',horaSolta:'07:40:00',numConc:'8'},
    {ano:'2025',num:'2',nome:'Jardinopolis-Sp',data:'15/06/2025',tipo:'Grande Fundo',oficial:'Oficial',latG:'021',latM:'08',latS:'12.0',lonG:'047',lonM:'52',lonS:'10.5',horaSolta:'07:35:00',numConc:'9'},
    {ano:'2025',num:'3',nome:'Sao Joaquim da Barra-Sp',data:'22/06/2025',tipo:'Grande Fundo',oficial:'Oficial',latG:'020',latM:'34',latS:'50.0',lonG:'047',lonM:'51',lonS:'20.0',horaSolta:'07:30:00',numConc:'10'},
    {ano:'2025',num:'4',nome:'Igarapava-Sp',data:'29/06/2025',tipo:'Grande Fundo',oficial:'Oficial',latG:'020',latM:'02',latS:'15.0',lonG:'047',lonM:'44',lonS:'40.0',horaSolta:'07:30:00',numConc:'11'},
    {ano:'2025',num:'5',nome:'Uberaba-Mg',data:'06/07/2025',tipo:'Grande Fundo',oficial:'Oficial',latG:'019',latM:'44',latS:'52.0',lonG:'047',lonM:'55',lonS:'55.0',horaSolta:'07:25:00',numConc:'12'},
    {ano:'2025',num:'6',nome:'Cravinhos-Sp',data:'08/06/2025',tipo:'Velocidade',oficial:'Oficial',latG:'021',latM:'19',latS:'45.0',lonG:'047',lonM:'42',lonS:'58.3',horaSolta:'07:40:00',numConc:'8'},
    {ano:'2025',num:'7',nome:'Jardinopolis-Sp',data:'15/06/2025',tipo:'Velocidade',oficial:'Oficial',latG:'021',latM:'08',latS:'12.0',lonG:'047',lonM:'52',lonS:'10.5',horaSolta:'07:35:00',numConc:'9'},
    {ano:'2025',num:'8',nome:'Sao Joaquim da Barra-Sp',data:'22/06/2025',tipo:'Velocidade',oficial:'Oficial',latG:'020',latM:'34',latS:'50.0',lonG:'047',lonM:'51',lonS:'20.0',horaSolta:'07:30:00',numConc:'10'},
    {ano:'2025',num:'9',nome:'Igarapava-Sp',data:'29/06/2025',tipo:'Velocidade',oficial:'Oficial',latG:'020',latM:'02',latS:'15.0',lonG:'047',lonM:'44',lonS:'40.0',horaSolta:'07:30:00',numConc:'11'},
    {ano:'2025',num:'10',nome:'Uberaba-Mg',data:'06/07/2025',tipo:'Velocidade',oficial:'Oficial',latG:'019',latM:'44',latS:'52.0',lonG:'047',lonM:'55',lonS:'55.0',horaSolta:'07:25:00',numConc:'12'},
    {ano:'2025',num:'11',nome:'Araguari-Go',data:'13/07/2025',tipo:'Fundo',oficial:'Oficial',latG:'018',latM:'38',latS:'20.0',lonG:'048',lonM:'11',lonS:'10.0',horaSolta:'07:20:00',numConc:'15'},
    {ano:'2025',num:'12',nome:'Catalao-Go',data:'20/07/2025',tipo:'Fundo',oficial:'Oficial',latG:'018',latM:'10',latS:'05.0',lonG:'047',lonM:'56',lonS:'30.0',horaSolta:'07:20:00',numConc:'16'},
    {ano:'2025',num:'13',nome:'Campo Alegre de Goias-Go',data:'02/08/2025',tipo:'Fundo',oficial:'Oficial',latG:'017',latM:'38',latS:'15.0',lonG:'047',lonM:'46',lonS:'50.0',horaSolta:'07:15:00',numConc:'17'},
    {ano:'2025',num:'14',nome:'Uberaba-Mg',data:'16/08/2025',tipo:'Fundo',oficial:'Oficial',latG:'019',latM:'44',latS:'52.0',lonG:'047',lonM:'55',lonS:'55.0',horaSolta:'07:25:00',numConc:'18'},
    {ano:'2025',num:'15',nome:'Cristalina-Go',data:'30/08/2025',tipo:'Fundo',oficial:'Oficial',latG:'016',latM:'46',latS:'10.0',lonG:'047',lonM:'36',lonS:'40.0',horaSolta:'07:10:00',numConc:'20'},
    {ano:'2025',num:'16',nome:'Brasilia-DF',data:'20/09/2025',tipo:'Fundo',oficial:'Oficial',latG:'015',latM:'42',latS:'01.1',lonG:'047',lonM:'48',lonS:'39.0',horaSolta:'06:35:00',numConc:'22'},
  ]);
  const [concursoEdit,setConcursoEdit]=useState({ano:'2025',num:'1',nome:'Cravinhos-Sp',data:'08/06/2025',numConc:'8',premios:'Sim',tipo:'Grande Fundo',oficial:'Sim',pontosPombos:'Sim',pontosConc:'Sim',noite1:'00:00:00',noite2:'00:00:00',noite3:'00:00:00',horaSolta:'07:40:00',obs:'',latG:'021',latM:'19',latS:'45.0',lonG:'047',lonM:'42',lonS:'58.3'});
  const [listConcParams,setListConcParams]=useState({deAno:'2025',deNum:'1',ateAno:'2025',ateNum:'16',daData:'',ateData:'31/12/2026',concursoTipo:'Todos',provasOficiais:'Todas',tipo:'Simples',ordenacao:'Numérica',destino:'Impressora'});
  const [distParams,setDistParams]=useState({deAno:'2025',deNum:'1',ateAno:'2025',ateNum:'16',deConc1:'11',deConc2:'33',deConc3:'77',deNome:'RENATO SOARES',ateConc1:'11',ateConc2:'33',ateConc3:'1517',ateNome:'VENERANDO SOARES DA SILVA',tipo:'Por concurso',listagem:'Corrida'});
  const [pombosEnv,setPombosEnv]=useState({ano:'2025',num:'1',assoc:'11',colec:'33',assocNome:'Federacao Paulista de Columbiofilia',encestados:'',doublagem:'',total:'0'});
  const [dadosProprios,setDadosProprios]=useState({nome:'CLUBE COLUMBOFILO LIMEIRENSE',morada:'LIMEIRA-SP',localidade:'',cod1:'19',cod2:'',telefone:'',fax:'',email:'',imprimeLogo:'Não'});
  const [config,setConfig]=useState({numEquipas:2,equipasVirt:'Não',pedeSexo:'Sim',tipoCoord:'Cartográfica',pombosSep:'Não',entidade:'Associação',zonas:'Sim',quartoAtivo:'Não',quantosPontuam:0,ordemMov:'Hora',nomeCamp:'',calcInter:'Por melhores Pombos Geral',numOcor:0,campColTodos:true,quantosCol:9999,premiosTodos:true,percEnv:100,premiosAte:99999,comZero:'Não',borraTipo:'Geral',borraQuantos:2});
  const [config2,setConfig2]=useState({pontuaColumbo:3,moeda:'€',numPombosCol:30,todosPombos:'Sim',sinalPor:'Por Prova'});
  const [locaisTab,setLocaisTab]=useState('Editar');
  const [localEdit,setLocalEdit]=useState({codigo:'0',nome:'',imprime:'Não',latG:'',latM:'',latS:'',lonG:'',lonM:'',lonS:''});
  const [locaisLista]=useState([
    {codigo:'1',nome:'PARAOPEBA/MG',imprime:'S'},
    {codigo:'2',nome:'CURVELO MG',imprime:'S'},
    {codigo:'3',nome:'CORINTO MG',imprime:'S'},
    {codigo:'4',nome:'JOAQUIM FELICIO MG',imprime:'S'},
    {codigo:'5',nome:'ENGENHEIRO NAVARRO MG',imprime:'S'},
    {codigo:'6',nome:'MONTES CLAROS MG',imprime:'S'},
    {codigo:'7',nome:'CAPITAO ENEAS MG',imprime:'S'},
    {codigo:'8',nome:'JANAUBA MG',imprime:'S'},
    {codigo:'9',nome:'MATO VERDE MG',imprime:'S'},
    {codigo:'10',nome:'GUANAMBI BA',imprime:'S'},
    {codigo:'11',nome:'ITABERA BA',imprime:'S'},
  ]);
  const [horaMorta,setHoraMorta]=useState({data:'',tempoMorto:'',horaInicio:'',horaFim:''});
  const [backup,setBackup]=useState({destino:'Disquete',loc:''});
  const [apagarConc,setApagarConc]=useState({ano:'0',num:'0',conc1:'0',conc2:'',conc3:'0'});
  const [pontosPerc,setPontosPerc]=useState({tipo:'Velocidade',pontos1:100,percPombos:100});
  const [assocTab,setAssocTab]=useState('Editar');
  const [assocEdit,setAssocEdit]=useState({codigo:'0',nome:'',morada:'',localidade:'',cod1:'0',cod2:'',cod3:'',telefone:'',fax:'',email:''});
  const [assocLista]=useState([
    {codigo:'11',nome:'Clube Columbófilo Limeirense',morada:'Elizabete Matie Ogawa Bobice nº100',localidade:'Limeira S.P',cod1:'1348',cod2:'614',cod3:'8',telefone:'1998748092',email:'glaucianosilva@gmail.com'},
  ]);
  const [colecTab,setColecTab]=useState('Editar');
  const [colecEdit,setColecEdit]=useState({assoc:'0',assocNome:'',colec:'',nome:'',morada:'',localidade:'',cod1:'0',cod2:'',cod3:'',telefone:'',fax:'',email:'',numFed:'0'});
  const [colecLista]=useState([
    {assoc:'11',assocNome:'Clube Columbófilo Limeirense',colec:'33',nome:'Federação Paulista de Columbófila',numFed:'1'},
  ]);
  const [concTab,setConcTab]=useState('Editar');
  const [concorrentesLista,setConcorrentesLista]=useState([
    {assoc:'11',col:'33',num:'77',nome:'RENATO SOARES',lat:'022-34-44.7',lon:'047-23-20.4',nlf:'1'},
    {assoc:'11',col:'33',num:'81',nome:'VILMAR ALMEIDA PORTA DO SOL',lat:'022-36-37.7',lon:'047-25-16.9',nlf:'1'},
    {assoc:'11',col:'33',num:'85',nome:'VALTER CARNEVALLI',lat:'022-34-49.9',lon:'047-41-55.7',nlf:'1'},
    {assoc:'11',col:'33',num:'91',nome:'EDSON ROBERTO DA SILVA',lat:'022-34-51.0',lon:'047-22-35.3',nlf:'1'},
    {assoc:'11',col:'33',num:'114',nome:'VALDIR DIAS',lat:'022-34-54.9',lon:'047-23-51.7',nlf:'1'},
    {assoc:'11',col:'33',num:'283',nome:'GLAUCION CLAITO SILVA',lat:'022-33-46.4',lon:'047-22-55.1',nlf:'1'},
    {assoc:'11',col:'33',num:'344',nome:'DAVID GONCALVES',lat:'023-06-18.8',lon:'047-09-49.3',nlf:'1'},
    {assoc:'11',col:'33',num:'1494',nome:'FABIO NOGUEIRA',lat:'022-34-03.6',lon:'047-25-56.4',nlf:'1'},
    {assoc:'11',col:'33',num:'1500',nome:'SIDNEI NICOLAU',lat:'022-33-27.8',lon:'047-25-53.7',nlf:'1'},
    {assoc:'11',col:'33',num:'1501',nome:'RODSON PINTO DE LIMA',lat:'022-35-29.2',lon:'047-16-48.2',nlf:'1'},
    {assoc:'11',col:'33',num:'1502',nome:'ADEMIR GACHET & SALVADOR',lat:'022-34-10.0',lon:'047-25-03.5',nlf:'1'},
    {assoc:'11',col:'33',num:'1503',nome:'PASCHOAL LOVADINI',lat:'022-42-04.0',lon:'047-39-40.2',nlf:'1'},
    {assoc:'11',col:'33',num:'1504',nome:'FERNANDO CRUZ ARAUJO',lat:'022-35-29.2',lon:'047-16-48.2',nlf:'1'},
    {assoc:'11',col:'33',num:'1505',nome:'CARLOS ROBERTO DIAS',lat:'022-40-56.5',lon:'047-40-00.7',nlf:'1'},
    {assoc:'11',col:'33',num:'1506',nome:'ANDRE ASSUNCAO',lat:'022-52-41.7',lon:'047-11-34.3',nlf:'1'},
    {assoc:'11',col:'33',num:'1507',nome:'JONATA & BRENO',lat:'022-32-55.7',lon:'046-37-10.9',nlf:'1'},
    {assoc:'11',col:'33',num:'1508',nome:'BORDIN & MARQUINHO',lat:'022-35-28.3',lon:'047-16-48.4',nlf:'1'},
    {assoc:'11',col:'33',num:'1510',nome:'CLAUDIO PICININI',lat:'022-34-44.0',lon:'046-41-10.0',nlf:'1'},
    {assoc:'11',col:'33',num:'1511',nome:'FLAVIO ESTEVES',lat:'022-43-27.2',lon:'047-37-14.3',nlf:'1'},
    {assoc:'11',col:'33',num:'1512',nome:'FRANCISCO TOLEDO RODOVALHO',lat:'022-35-24.8',lon:'047-24-35.7',nlf:'1'},
    {assoc:'11',col:'33',num:'1513',nome:'VALTER CINTRA',lat:'022-33-26.2',lon:'047-26-30.3',nlf:'1'},
    {assoc:'11',col:'33',num:'1514',nome:'SERGIO MAZZARAT',lat:'022-35-34.0',lon:'047-22-26.0',nlf:'1'},
    {assoc:'11',col:'33',num:'1515',nome:'CARLOS ALBERTO DA SILVA',lat:'022-43-12.0',lon:'047-22-06.0',nlf:'1'},
    {assoc:'11',col:'33',num:'1516',nome:'PAULO SALES',lat:'022-28-43.9',lon:'047-28-14.2',nlf:'1'},
    {assoc:'11',col:'33',num:'1517',nome:'VENERANDO SOARES DA SILVA',lat:'022-46-03.2',lon:'047-34-55.9',nlf:'1'},
  ]);
  const [concEdit,setConcEdit]=useState({assoc:'0',col:'',num:'0',nome:'',morada:'',localidade:'',cod1:'0',cod2:'',telefone:'',fax:'',email:'',licFed:'0',doublagem:'Não',grupoFundo:'Não',pagaList:'Não',tipo:'Concorrente',sorteio:'Não',latG:'',latM:'',latS:'',lonG:'',lonM:'',lonS:''});
  const [listConcWin,setListConcWin]=useState({deAssoc:'11',deColec:'33',ateAssoc:'11',ateColec:'33',conc1:'Todos',conc2:'Todos',tipo:'Simples II',ordenacao:'Numérica',destino:'Impressora'});
  const [pomboTab,setPomboTab]=useState('Editar');
  const [pomboEdit,setPomboEdit]=useState({anilha:'',assoc:'0',colec:'',num:'0',nome:'',morada:'',localidade:'',cod1:'0',cod2:'',telefone:'',sexo:'Macho',pomboFe:'Não',equipaFixa:'Não',dataIntro:'//'});
  const [pombosLista,setPombosLista]=useState([
    {anilha:'0000023/22',assoc:'11',colec:'33',num:'1508',sexo:'M'},
    {anilha:'0000024/22',assoc:'11',colec:'33',num:'1508',sexo:'M'},
    {anilha:'0000025/22',assoc:'11',colec:'33',num:'1508',sexo:'M'},
    {anilha:'0000026/22',assoc:'11',colec:'33',num:'1508',sexo:'M'},
    {anilha:'0000027/22',assoc:'11',colec:'33',num:'1508',sexo:'M'},
    {anilha:'0000028/22',assoc:'11',colec:'33',num:'1508',sexo:'M'},
    {anilha:'0000036/22',assoc:'11',colec:'33',num:'1508',sexo:'M'},
    {anilha:'0000037/22',assoc:'11',colec:'33',num:'1508',sexo:'M'},
    {anilha:'0000038/22',assoc:'11',colec:'33',num:'1508',sexo:'M'},
    {anilha:'0000039/22',assoc:'11',colec:'33',num:'1508',sexo:'M'},
    {anilha:'0000187/22',assoc:'11',colec:'33',num:'1507',sexo:'M'},
    {anilha:'0000191/22',assoc:'11',colec:'33',num:'1507',sexo:'M'},
    {anilha:'0000200/22',assoc:'11',colec:'33',num:'1507',sexo:'M'},
    {anilha:'0000265/22',assoc:'11',colec:'33',num:'283',sexo:'M'},
    {anilha:'0000268/22',assoc:'11',colec:'33',num:'1508',sexo:'M'},
    {anilha:'0000271/22',assoc:'11',colec:'33',num:'1508',sexo:'M'},
    {anilha:'0034945/20',assoc:'11',colec:'33',num:'283',sexo:'M'},
    {anilha:'0084701/20',assoc:'11',colec:'33',num:'1508',sexo:'M'},
    {anilha:'0084748/20',assoc:'11',colec:'33',num:'1508',sexo:'M'},
    {anilha:'0084751/20',assoc:'11',colec:'33',num:'1508',sexo:'M'},
    {anilha:'0084841/20',assoc:'11',colec:'33',num:'1508',sexo:'M'},
    {anilha:'0084842/20',assoc:'11',colec:'33',num:'1508',sexo:'M'},
    {anilha:'0084845/20',assoc:'11',colec:'33',num:'1508',sexo:'M'},
    {anilha:'0084889/20',assoc:'11',colec:'33',num:'1508',sexo:'M'},
    {anilha:'0140303/20',assoc:'11',colec:'33',num:'283',sexo:'M'},
    {anilha:'0140341/20',assoc:'11',colec:'33',num:'283',sexo:'M'},
    {anilha:'0140344/20',assoc:'11',colec:'33',num:'283',sexo:'M'},
    {anilha:'0140345/20',assoc:'11',colec:'33',num:'283',sexo:'M'},
    {anilha:'0140347/20',assoc:'11',colec:'33',num:'283',sexo:'M'},
    {anilha:'0140348/20',assoc:'11',colec:'33',num:'283',sexo:'M'},
    {anilha:'0140350/20',assoc:'11',colec:'33',num:'283',sexo:'M'},
    {anilha:'0140352/20',assoc:'11',colec:'33',num:'283',sexo:'M'},
    {anilha:'0140354/20',assoc:'11',colec:'33',num:'283',sexo:'M'},
    {anilha:'0140356/20',assoc:'11',colec:'33',num:'283',sexo:'M'},
    {anilha:'0140357/20',assoc:'11',colec:'33',num:'283',sexo:'M'},
    {anilha:'0140369/20',assoc:'11',colec:'33',num:'283',sexo:'M'},
    {anilha:'1134642/21',assoc:'11',colec:'33',num:'283',sexo:'M'},
  ]);
  const [listPombosWin,setListPombosWin]=useState({dePombo:'0000023/22',atePombo:'9641564/24',deAssoc:'11',deColec:'33',deNum:'77',deNome:'RENATO SOARES',ateAssoc:'11',ateColec:'33',ateNum:'1517',ateNome:'VENERANDO SOARES DA SILVA',deData:'',ateData:'31/12/2025',tipo:'Por pombo'});

  // ===== VINCENTY FRONTEND (mesmo motor do server.js - 0.5mm) =====
  const vincenty = (lat1,lon1,lat2,lon2) => {
    if(lat1===lat2 && lon1===lon2) return 0;
    const a=6378137, f=1/298.257223563, b=(1-f)*a;
    const toRad=d=>d*Math.PI/180;
    const phi1=toRad(lat1), phi2=toRad(lat2), L=toRad(lon2-lon1);
    const U1=Math.atan((1-f)*Math.tan(phi1)), U2=Math.atan((1-f)*Math.tan(phi2));
    const sinU1=Math.sin(U1), cosU1=Math.cos(U1), sinU2=Math.sin(U2), cosU2=Math.cos(U2);
    let lambda=L, lambdaP, iter=100, sinSigma, cosSigma, sigma, sinAlpha, cosSqAlpha, cos2SigmaM;
    do{
      const sinLambda=Math.sin(lambda), cosLambda=Math.cos(lambda);
      sinSigma=Math.sqrt((cosU2*sinLambda)**2 + (cosU1*sinU2 - sinU1*cosU2*cosLambda)**2);
      if(sinSigma===0) return 0;
      cosSigma=sinU1*sinU2 + cosU1*cosU2*cosLambda;
      sigma=Math.atan2(sinSigma, cosSigma);
      sinAlpha=(cosU1*cosU2*sinLambda)/sinSigma;
      cosSqAlpha=1 - sinAlpha*sinAlpha;
      cos2SigmaM=cosSqAlpha!==0 ? cosSigma - 2*sinU1*sinU2/cosSqAlpha : 0;
      const C=f/16*cosSqAlpha*(4+f*(4-3*cosSqAlpha));
      lambdaP=lambda;
      lambda=L + (1-C)*f*sinAlpha*(sigma + C*sinSigma*(cos2SigmaM + C*cosSigma*(-1+2*cos2SigmaM**2)));
    } while(Math.abs(lambda-lambdaP)>1e-12 && --iter>0);
    if(iter===0) return NaN;
    const uSq=cosSqAlpha*(a*a-b*b)/(b*b);
    const A=1+uSq/16384*(4096+uSq*(-768+uSq*(320-175*uSq)));
    const B=uSq/1024*(256+uSq*(-128+uSq*(74-47*uSq)));
    const deltaSigma=B*sinSigma*(cos2SigmaM + B/4*(cosSigma*(-1+2*cos2SigmaM**2) - B/6*cos2SigmaM*(-3+4*sinSigma**2)*(-3+4*cos2SigmaM**2)));
    return Number((b*A*(sigma-deltaSigma)).toFixed(1));
  };
  const parseCoord = (g,m,s) => {
    const gg=parseFloat(g)||0, mm=parseFloat(m)||0, ss=parseFloat(s)||0;
    return gg + mm/60 + ss/3600;
  };
  // Calcula distância concurso -> concorrente
  const calcDistancia = (conc, concorrente) => {
    // conc pode ter latG/latM/latS ou lat string
    let clat, clon;
    if(conc.latG) clat=parseCoord(conc.latG,conc.latM,conc.latS);
    else if(conc.lat) { const p=conc.lat.split('-'); clat=parseCoord(p[0],p[1],p[2]); }
    else clat=parseCoord('015','42','01.1');
    if(conc.lonG) clon=parseCoord(conc.lonG,conc.lonM,conc.lonS);
    else if(conc.lon) { const p=conc.lon.split('-'); clon=parseCoord(p[0],p[1],p[2]); }
    else clon=parseCoord('047','48','39.0');
    // concorrente
    let rlat, rlon;
    if(concorrente.lat) { const p=concorrente.lat.split('-'); rlat=parseCoord(p[0],p[1],p[2]); }
    else rlat=parseCoord('022','34','44.7');
    if(concorrente.lon) { const p=concorrente.lon.split('-'); rlon=parseCoord(p[0],p[1],p[2]); }
    else rlon=parseCoord('047','23','20.4');
    return vincenty(clat, clon, rlat, rlon);
  };

  // ===== FUNÇÕES INTERLIGADAS =====
  const salvarConcurso = () => {
    const novo={ano:concursoEdit.ano,num:concursoEdit.num,nome:concursoEdit.nome,data:concursoEdit.data,tipo:concursoEdit.tipo,oficial:concursoEdit.oficial,latG:concursoEdit.latG,latM:concursoEdit.latM,latS:concursoEdit.latS,lonG:concursoEdit.lonG,lonM:concursoEdit.lonM,lonS:concursoEdit.lonS,horaSolta:concursoEdit.horaSolta,numConc:concursoEdit.numConc};
    setConcursosLista(prev=>{
      const idx=prev.findIndex(c=>c.ano===novo.ano && c.num===novo.num);
      if(idx>=0){ const n=[...prev]; n[idx]=novo; return n; }
      return [...prev, novo];
    });
    // Atualiza concurso global ativo
    setConcurso({ano:novo.ano,num:novo.num,nome:novo.nome,data:novo.data,tipo:novo.tipo,lat:novo.latG+'-'+novo.latM+'-'+novo.latS,lon:novo.lonG+'-'+novo.lonM+'-'+novo.lonS,horaSolta:novo.horaSolta,enviados:parseInt(novo.numConc)*12||300,tempoMorto:'10:52:00'});
    setMsg('Concurso '+novo.ano+'/'+novo.num+' '+novo.nome+' guardado e interligado — '+concursosLista.length+' concursos ativos');
  };
  const salvarConcorrente = () => {
    const novo={assoc:concEdit.assoc,col:concEdit.col,num:concEdit.num,nome:concEdit.nome,lat:concEdit.latG+'-'+concEdit.latM+'-'+concEdit.latS,lon:concEdit.lonG+'-'+concEdit.lonM+'-'+concEdit.lonS,nlf:'1'};
    setConcorrentesLista(prev=>{
      const idx=prev.findIndex(c=>c.num===novo.num && c.col===novo.col);
      if(idx>=0){ const n=[...prev]; n[idx]={...n[idx], ...novo}; return n; }
      return [...prev, novo];
    });
    setMsg('Concorrente '+novo.assoc+'/'+novo.col+'/'+novo.num+' '+novo.nome+' guardado — '+concorrentesLista.length+' concorrentes');
  };
  const salvarPombo = () => {
    const novo={anilha:pomboEdit.anilha,assoc:pomboEdit.assoc,colec:pomboEdit.colec,num:pomboEdit.num,sexo:pomboEdit.sexo==='Macho'?'M':pomboEdit.sexo==='Fêmea'?'F':'?'};
    setPombosLista(prev=>{
      const idx=prev.findIndex(p=>p.anilha===novo.anilha);
      if(idx>=0){ const n=[...prev]; n[idx]=novo; return n; }
      return [...prev, novo];
    });
    setMsg('Pombo '+novo.anilha+' guardado — '+pombosLista.length+' pombos — Concorrente '+novo.num);
  };
  const selecionarConcursoGlobal = (c) => {
    const full={ano:c.ano,num:c.num,nome:c.nome,data:c.data,tipo:c.tipo,lat:c.latG+'-'+c.latM+'-'+c.latS,lon:c.lonG+'-'+c.lonM+'-'+c.lonS,horaSolta:c.horaSolta,enviados:parseInt(c.numConc)*18||300,tempoMorto:'10:52:00'};
    setConcurso(full);
    setConcursoEdit({ano:c.ano,num:c.num,nome:c.nome,data:c.data,numConc:c.numConc,premios:'Sim',tipo:c.tipo,oficial:'Sim',pontosPombos:'Sim',pontosConc:'Sim',noite1:'00:00:00',noite2:'00:00:00',noite3:'00:00:00',horaSolta:c.horaSolta,obs:'Importado do cadastro '+c.ano+'/'+c.num,latG:c.latG,latM:c.latM,latS:c.latS,lonG:c.lonG,lonM:c.lonM,lonS:c.lonS});
    setPombosEnv({...pombosEnv,ano:c.ano,num:c.num});
    setMsg('Concurso '+c.ano+'/'+c.num+' '+c.nome+' ATIVO — Lat '+c.latG+'° Lon '+c.lonG+'° — Hora '+c.horaSolta+' — Matriz recalculada para '+concorrentesLista.length+' concorrentes');
  };


  // Calculo automático quando muda anilha/hora/concurso
  const calcularVoo=()=>{
    // Usa coordenadas reais do concurso (latG/M/S) importadas da lupa — não depende mais de locais[]
    let cLat, cLon;
    if(concurso.latG) cLat=parseCoord(concurso.latG,concurso.latM,concurso.latS);
    else if(concurso.lat) { const p=concurso.lat.split('-'); cLat=parseCoord(p[0],p[1],p[2]); }
    else return;
    if(concurso.lonG) cLon=parseCoord(concurso.lonG,concurso.lonM,concurso.lonS);
    else if(concurso.lon) { const p=concurso.lon.split('-'); cLon=parseCoord(p[0],p[1],p[2]); }
    else return;
    // Concorrente selecionado no lançamento
    const concSel = concorrentesLista.find(cc=>cc.num===form.concorrente || cc.num===String(form.concorrente).split('/').pop());
    const soc = form.concorrente ? (concorrentesLista.find(cc=>cc.num===String(form.concorrente).split('/').pop()) || socios.find(s=>String(s.id)===String(form.concorrente))) : null;
    // Tenta concorrentesLista primeiro (tem lat/lon real), fallback para socios
    let sLat, sLon;
    if(concSel && concSel.lat) { const p=concSel.lat.split('-'); sLat=parseCoord(p[0],p[1],p[2]); const q=concSel.lon.split('-'); sLon=parseCoord(q[0],q[1],q[2]); }
    else if(soc && soc.lat) { sLat=soc.lat; sLon=soc.lon; }
    else return;
    const dist=vincenty(cLat,cLon,sLat,sLon);
    // Só calcula média se houver hora de chegada preenchida — senão deixa vazio
    const hasHora = form.horaCheg && form.horaCheg.includes(':') && !form.horaCheg.includes('HH');
    let mediaTxt='—';
    let tempoMin=0;
    if(hasHora){
      // Calcula tempo real: chegada - solta (horaSolta do concurso)
      const [hs,ms,ss]= (concurso.horaSolta||'06:35:00').split(':').map(Number);
      const [hc,mc,sc]= form.horaCheg.split(':').map(Number);
      const soltaMin=hs*60+ms+ss/60;
      let chegadaMin=hc*60+mc+sc/60;
      // Se chegada for no dia seguinte (ex: solta 06:35, chegada 17:20 -> mesmo dia)
      if(chegadaMin < soltaMin) chegadaMin+=1440;
      tempoMin=chegadaMin - soltaMin + (parseInt(form.diasPlus)||0)*1440;
      if(tempoMin>0) mediaTxt=(dist/tempoMin).toFixed(3);
    }
    setForm(f=>({...f,distancia:dist.toFixed(1),media:mediaTxt}));
    if(hasHora) setMsg(`Distância WGS84: ${dist.toFixed(1)} m | Média ${mediaTxt} m/min (Uberaba real 322km, não 751km)`);
    else setMsg(`Distância WGS84: ${dist.toFixed(1)} m — preencha Hora de Chegada para calcular média`);
  };
  useEffect(()=>{ if(form.anilha || form.concorrente || concurso.num) calcularVoo(); },[form.concorrente,form.anilha,concurso.num]);
  // Limpa lançamento ao trocar de concurso (campos limpos como pedido)
  useEffect(()=>{
    if(concurso.num && wins.includes('lancamento')){
      // Quando concurso muda via lupa, limpa anilha/distancia/media mas mantém concurso ativo
      setForm(f=>({...f, anilha:'', concorrente:'', distancia:'', media:''}));
    }
  },[concurso.num]);

  const rodarCalculo=()=>{
    const seq=['apagar','dist','preencher','tempo','lugares','premios','coef'];
    let i=0;
    const timer=setInterval(()=>{
      if(i<seq.length){
        setSteps(s=>({...s,[seq[i]]:true}));
        i++;
      } else {
        clearInterval(timer);
        setCalcDone(true);
        setSteps(s=>({...s,sec:true}));
        setMsg('Procedimento Terminado sem Anomalias — Cálculo da Prova concluído.');
      }
    },450);
  };
  const apagarCalculo=()=>{ setSteps({apagar:false,dist:false,preencher:false,tempo:false,lugares:false,premios:false,coef:false,sec:false}); setCalcDone(false); setMsg('Cálculo anterior apagado.'); };

  // Resultado mock classificação (igual folha)
  const classDados=[
    {lugar:1,concorrente:'33/1508 - BORDIN & MARQUINHO',pontos:296, veloc:98, meio:87, fundo:111, filh:0, geral:296},
    {lugar:2,concorrente:'33/  81 - VILMAR ALMEIDA PORTA DO SOL',pontos:281, veloc:88, meio:92, fundo:101, filh:0, geral:281},
    {lugar:3,concorrente:'33/ 283 - GLAUCION CLAITO SILVA',pontos:274, veloc:95, meio:79, fundo:100, filh:0, geral:274},
    {lugar:4,concorrente:'33/  91 - EDSON ROBERTO DA SILVA',pontos:243, veloc:76, meio:84, fundo:83, filh:0, geral:243},
    {lugar:5,concorrente:'33/1515 - CARLOS ALBERTO DA SILVA',pontos:242, veloc:82, meio:77, fundo:83, filh:0, geral:242},
  ];
  const pombosProva=[
    {cls:1,anilha:'0084751/20',p:'S',d:'S',e:'S',concorrente:'33/1508 - BORDIN & MARQUINHO',cheg:'17:20:10',caixa:0,dist:'764823.2',media:'1185.466',pontos:100},
    {cls:2,anilha:'2320071/23',p:'S',d:'S',e:'S',concorrente:'33/1508 - BORDIN & MARQUINHO',cheg:'17:20:12',caixa:0,dist:'764823.2',media:'1185.405',pontos:99},
    {cls:3,anilha:'2320071/23',p:'S',d:'S',e:'S',concorrente:'33/ 81 - VILMAR ALMEIDA PORTA DO SOL',cheg:'17:22:06',caixa:0,dist:'760154.0',media:'988.278',pontos:98},
  ];

  const W={
    bg:'#008080', desktop:'#c0c0c0', titleFrom:'#000080', titleTo:'#1084d0',
    winBg:'#c0c0c0', field:'#fff', border:'#808080', inset:'#fff'
  };

  const s={
    app:{fontFamily:'MS Sans Serif, Tahoma, Arial',fontSize:'11px',backgroundColor:W.bg,height:'100vh',display:'flex',flexDirection:'column',overflow:'hidden'},
    title:{background:`linear-gradient(90deg, ${W.titleFrom}, ${W.titleTo})`,color:'#fff',padding:'3px 6px',fontWeight:'bold',display:'flex',justifyContent:'space-between',fontSize:'11px'},
    menubar:{backgroundColor:W.desktop,borderBottom:'1px solid #808080',display:'flex',flexWrap:'wrap',gap:'0',fontSize:'11px',position:'relative',zIndex:20},
    menuItem:(active)=>({padding:'3px 8px',cursor:'pointer',backgroundColor:active?'#000080':'transparent',color:active?'#fff':'#000'}),
    dropdown:{position:'absolute',top:'100%',left:0,backgroundColor:W.desktop,border:'2px outset #fff',boxShadow:'3px 3px 6px rgba(0,0,0,0.4)',minWidth:'320px',zIndex:50,maxHeight:'70vh',overflowY:'auto'},
    mi:{padding:'3px 10px',cursor:'pointer',borderBottom:'1px solid #c0c0c0',display:'flex',justifyContent:'space-between'},
    submenu:{padding:'2px 10px 2px 20px',cursor:'pointer',fontSize:'11px',borderBottom:'1px solid #e0e0e0'},
    toolbar:{backgroundColor:W.desktop,borderBottom:'2px groove #fff',padding:'3px 4px',display:'flex',gap:'3px'},
    tbtn:{padding:'2px 4px',border:'2px outset #fff',backgroundColor:W.desktop,cursor:'pointer',fontSize:'11px'},
    mdi:{flex:1,backgroundColor:'#5a6d7e',padding:'8px',overflowY:'auto',display:'flex',flexDirection:'column',gap:'10px',alignItems:'center'},
    win:{backgroundColor:W.winBg,border:'2px outset #fff',boxShadow:'4px 4px 12px rgba(0,0,0,0.6)',width:'820px',maxWidth:'96%'},
    winTitle:{background:`linear-gradient(90deg, ${W.titleFrom}, ${W.titleTo})`,color:'#fff',padding:'2px 6px',fontWeight:'bold',display:'flex',justifyContent:'space-between',fontSize:'11px'},
    body:{padding:'8px',backgroundColor:W.winBg},
    field:{border:'2px inset #fff',backgroundColor:W.field,padding:'2px 4px',fontFamily:'MS Sans Serif',fontSize:'11px'},
    label:{fontSize:'11px'},
    group:{border:'2px groove #fff',padding:'6px',backgroundColor:W.winBg,marginBottom:'6px'},
    btn:{border:'2px outset #fff',backgroundColor:W.desktop,padding:'4px 10px',cursor:'pointer',fontSize:'11px',minWidth:'70px'},
    status:{backgroundColor:W.desktop,borderTop:'2px groove #fff',padding:'2px 8px',display:'flex',justifyContent:'space-between',fontSize:'11px'},
    checkOk:{color:'#0a7c00',fontWeight:'bold'},
  };

  const Item=({children,onClick})=> <div style={s.mi} onClick={onClick}><span>{children}</span></div>;
  const Sub=({children,onClick})=> <div style={s.submenu} onClick={onClick}>↳ {children}</div>;

  return (
    <div style={s.app} onClick={()=>menu&&setMenu(null)}>
      <div style={s.title}><span>Sistema Gestão Columbófila — S.G.S.P — CLUBE COLUMBÓFILO LIMEIRENSE</span><span style={{fontWeight:'normal'}}>S.G.S.P</span></div>

      <div style={s.menubar} onClick={e=>e.stopPropagation()}>
        <div style={{position:'relative'}}><div style={s.menuItem(menu==='movimentos')} onClick={()=>setMenu(menu==='movimentos'?null:'movimentos')}>Movimentos</div>
          {menu==='movimentos' && <div style={s.dropdown}>
            <div style={{backgroundColor:'#000080',color:'#fff',padding:'3px 8px',fontWeight:'bold',fontSize:'10px'}}>LANÇAMENTO E CÁLCULO</div>
            <Item onClick={()=>open('lancamento')}>Lançamento da Prova</Item>
            <Item onClick={()=>open('calculo')}>Cálculo de Prova</Item>
            <Item onClick={()=>open('lancamento')}>Marcação de movimentos</Item>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'4px 0'}}></div>
            <Item onClick={()=>open('relatorio')}>Listagem de conferência</Item>
            <Item onClick={()=>open('classificacao')}>Listagem de classificações por pombo</Item>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'4px 0'}}></div>
            <Item onClick={()=>open('lancamento')}>Importar prova de relógio</Item>
            <Item onClick={()=>open('relatorio')}>Impressão de folha de relógio</Item>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'4px 0'}}></div>
            <Item onClick={()=>setMsg('Exportação para Associação')}>Exportação de movimentos para a Associação</Item>
            <Item onClick={()=>setMsg('Importação movimentos')}>Importação de movimentos</Item>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'4px 0'}}></div>
            <Item onClick={()=>setMsg('Doublagem')}>Exportação de movimentos de Doublagem</Item>
            <Item onClick={()=>setMsg('Doublagem import')}>Importação de movimentos de Doublagem</Item>
            <Item onClick={()=>setMsg('Grupo Fundo')}>Exportação de movimentos para Grupo de Fundo</Item>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'4px 0'}}></div>
            <Item onClick={()=>open('exportTotal')}>Exportação de prova Total</Item>
            <Item onClick={()=>open('exportTotal')}>Exportação de Total de Movimentos</Item>
            <Item onClick={()=>setMsg('Alojar internet')}>Alojar Classificações na internet</Item>
            <Item onClick={()=>setMsg('Federação')}>Exportação de movimentos para Federação</Item>
            <Item onClick={()=>open('exportGPB')}>Exportação de Classificações para Sistema S.G.S.P</Item>
          </div>}
        </div>
        <div style={{position:'relative'}}><div style={s.menuItem(menu==='listarProvas')} onClick={()=>setMenu(menu==='listarProvas'?null:'listarProvas')}>Listar provas</div>
          {menu==='listarProvas' && <div style={s.dropdown}>
            <Sub onClick={()=>open('classificacao')}>InterColectividades</Sub>
            <Sub onClick={()=>open('classificacao')}>Concorrentes - Designados</Sub>
            <Sub onClick={()=>open('pombos')}>Pombos Designados</Sub>
            <Sub onClick={()=>open('pombosProva')}>Pombos na Prova</Sub>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'4px 0'}}></div>
            <Sub onClick={()=>setMsg('Borrachos')}>Concorrentes - Borrachos</Sub>
            <Sub onClick={()=>setMsg('Borrachos pombos')}>Pombos - Borrachos</Sub>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'4px 0'}}></div>
            <Sub onClick={()=>setMsg('Campeonato')}>Campeonato Secundário - Concorrentes</Sub>
            <Sub onClick={()=>setMsg('Equipas')}>Equipas Variaveis / Fixas / Pombos de Fé / Colónias / 4º Campeonato</Sub>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'4px 0'}}></div>
            <Sub onClick={()=>open('pombosProva')}>Prémios Monetários por Prova</Sub>
            <Sub onClick={()=>open('classificacao')}>Pombos, Pontos e Prémios por Concorrente</Sub>
            <Sub onClick={()=>open('classificacao')}>Classificação de Prova com Coeficientes</Sub>
            <Sub onClick={()=>open('classificacao')}>Classificação de Pombos por Concorrente</Sub>
            <Sub onClick={()=>open('concTotaisWin')}>Classificação de Prova e Total</Sub>
          </div>}
        </div>
        <div style={{position:'relative'}}><div style={s.menuItem(menu==='listarTotais')} onClick={()=>setMenu(menu==='listarTotais'?null:'listarTotais')}>Listar Totais</div>
          {menu==='listarTotais' && <div style={{...s.dropdown,minWidth:'380px'}}>
            <Sub onClick={()=>setMsg('Colectividades')}>Colectividades</Sub>
            <Sub onClick={()=>open('concTotaisWin')}>Concorrentes</Sub>
            <Sub onClick={()=>open('pombosTotaisWin')}>Pombos</Sub>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'2px 0'}}></div>
            <Sub onClick={()=>setMsg('Borrachos')}>Concorrentes - Borrachos</Sub>
            <Sub onClick={()=>setMsg('Borrachos')}>Pombos - Borrachos</Sub>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'2px 0'}}></div>
            <Sub onClick={()=>setMsg('Campeonato')}>Campeonato Secundário - Concorrentes</Sub>
            <Sub onClick={()=>setMsg('Campeonato')}>Campeonato Secundário - Pombos</Sub>
            <Sub onClick={()=>setMsg('Campeonato')}>Campeonato Secundário - Prémios Monetários</Sub>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'2px 0'}}></div>
            <Sub onClick={()=>open('concTotaisWin')}>Classificação Geral de Concorrentes</Sub>
            <Sub onClick={()=>open('pombosTotaisWin')}>Classificação Geral de Pombos</Sub>
            <Sub onClick={()=>open('pombosTotaisWin')}>Classificação Geral Pombos - Regularidade</Sub>
            <Sub onClick={()=>setMsg('Equipas')}>Equipas Variaveis</Sub>
            <Sub onClick={()=>setMsg('Equipas')}>Equipas Fixas</Sub>
            <Sub onClick={()=>open('pombosFeWin')}>Pombos de Fé</Sub>
            <Sub onClick={()=>setMsg('Equipas')}>Colónias</Sub>
            <Sub onClick={()=>setMsg('Equipas')}>4º Campeonato</Sub>
            <Sub onClick={()=>setMsg('Premios')}>Prémios monetários acumulados</Sub>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'2px 0'}}></div>
            <Sub onClick={()=>open('palmares')}>Palmarés do Pombo</Sub>
            <Sub onClick={()=>open('classificacao')}>Classificação de pombos por Concorrente</Sub>
            <Sub onClick={()=>open('concTotaisWin')}>Classificação de Concorrentes</Sub>
            <Sub onClick={()=>setMsg('Coeficientes')}>Coeficientes de pombos</Sub>
            <Sub onClick={()=>setMsg('Analise')}>Análise Classificações - Columbófilo</Sub>
            <Sub onClick={()=>open('pomboAs')}>Análise Classificações - Pombo Ás</Sub>
            <Sub onClick={()=>setMsg('Federacao')}>Envio de dados para Federação</Sub>
            <Sub onClick={()=>setMsg('Analise2')}>Análise Classificações 2 anos</Sub>
            <Sub onClick={()=>setMsg('Exposicao')}>Exposição Nacional</Sub>
          </div>}
        </div>
        <div style={{position:'relative'}}><div style={s.menuItem(menu==='concurso')} onClick={()=>setMenu(menu==='concurso'?null:'concurso')}>Concurso</div>
          {menu==='concurso' && <div style={s.dropdown}>
            <Item onClick={()=>open('tabelaConcursos')}>Concursos</Item>
            <Item onClick={()=>open('listagemConcursosWin')}>Listagem de Concursos</Item>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'4px 0'}}></div>
            <Item onClick={()=>open('listagemDistanciasWin')}>Listagem de Distâncias</Item>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'4px 0'}}></div>
            <div style={{padding:'3px 10px',fontWeight:'bold',backgroundColor:'#000080',color:'#fff',fontSize:'10px'}}>Pombos Enviados</div>
            <Sub onClick={()=>open('pombosEnviadosWin')}>▶ Introdução pelo total</Sub>
            <Sub onClick={()=>open('pombosEnviadosWin')}>▶ Introdução por concorrente</Sub>
            <Sub onClick={()=>open('pombosEnviadosWin')}>Listagem de Pombos Enviados</Sub>
            <Sub onClick={()=>open('pombosEnviadosWin')}>Listagem de Pombos Enviados por Concorrente</Sub>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'4px 0'}}></div>
            <Sub onClick={()=>setMsg('Grupos não oficiais')}>Grupos de Concursos não Oficiais</Sub>
            <Sub onClick={()=>setMsg('Campeonatos Secundarios')}>Campeonatos Secundários</Sub>
          </div>}
        </div>
        <div style={{position:'relative'}}><div style={s.menuItem(menu==='pombos')} onClick={()=>setMenu(menu==='pombos'?null:'pombos')}>Pombos</div>
          {menu==='pombos' && <div style={{...s.dropdown,minWidth:'340px'}}>
            <Sub onClick={()=>open('manutencaoPombosWin')}>Pombos</Sub>
            <Sub onClick={()=>open('listagemPombosWin')}>Listagem de Pombos por Ano/Anilha</Sub>
            <Sub onClick={()=>open('listagemPombosWin')}>Listagem de Pombos de Équipa</Sub>
            <Sub onClick={()=>open('listagemPombosWin')}>Listagem de Pombos de Equipas Fixas</Sub>
            <Sub onClick={()=>open('listagemPombosWin')}>Listagem de Pombos activos/desactivos</Sub>
            <Sub onClick={()=>setMsg('Minuta de Recenseamento')}>Minuta de Recenseamento</Sub>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'2px 0'}}></div>
            <Sub onClick={()=>setMsg('Anulação de Recenseamento por ano')}>Anulação de Recenseamento por ano</Sub>
            <Sub onClick={()=>setMsg('Anulação de Colónia')}>Anulação de Colónia</Sub>
            <Sub onClick={()=>setMsg('Transferência de Colónia')}>Transferência de Colónia</Sub>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'2px 0'}}></div>
            <Sub onClick={()=>setMsg('Exportação de pombos')}>Exportação de pombos</Sub>
            <Sub onClick={()=>setMsg('Importação de pombos')}>Importação de pombos</Sub>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'2px 0'}}></div>
            <Sub onClick={()=>setMsg('Exportação de pombos de Doublagem')}>Exportação de pombos de Doublagem</Sub>
            <Sub onClick={()=>setMsg('Importação de pombos de Doublagem')}>Importação de pombos de Doublagem</Sub>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'2px 0'}}></div>
            <Sub onClick={()=>setMsg('Importação de pombos do RECPOM')}>Importação de pombos do RECPOM</Sub>
            <Sub onClick={()=>setMsg('Cópia de ficheiros do RECPOM')}>Cópia de ficheiros do RECPOM</Sub>
            <Sub onClick={()=>setMsg('Verificar ficheiro de RECPOM copiado')}>Verificar ficheiro de RECPOM copiado</Sub>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'2px 0'}}></div>
            <Sub onClick={()=>setMsg('Confrontação de Pombos')}>Confrontação de Pombos</Sub>
          </div>}
        </div>
        <div style={{position:'relative'}}><div style={s.menuItem(menu==='concorrente')} onClick={()=>setMenu(menu==='concorrente'?null:'concorrente')}>Concorrente</div>
          {menu==='concorrente' && <div style={{...s.dropdown,minWidth:'340px'}}>
            <Sub onClick={()=>open('tabelaConcorrentes')}>Concorrentes</Sub>
            <Sub onClick={()=>open('listagemConcorrentesWin')}>Listagem de Concorrentes</Sub>
            <Sub onClick={()=>open('listagemConcorrentesWin')}>Listagem de Sócios</Sub>
            <Sub onClick={()=>setMsg('Etiquetas')}>Etiquetas de Concorrentes e Sócios</Sub>
            <Sub onClick={()=>setMsg('NIF')}>Consulta por N.I.F</Sub>
            <Sub onClick={()=>setMsg('Nome')}>Consulta por Nome</Sub>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'2px 0'}}></div>
            <Sub onClick={()=>setMsg('Sorteio')}>Listagem de Concorrentes de Sorteio</Sub>
            <Sub onClick={()=>setMsg('Tabela Sorteio')}>Tabela de Sorteios</Sub>
            <Sub onClick={()=>setMsg('Sorteio')}>Sorteio de Concorrentes</Sub>
            <Sub onClick={()=>setMsg('Eliminacao')}>Eliminação de Sorteio</Sub>
            <Sub onClick={()=>setMsg('Listagem')}>Listagem de Sorteio</Sub>
            <Sub onClick={()=>setMsg('Resultados')}>Listagem de Resultados</Sub>
            <Sub onClick={()=>setMsg('Eliminar')}>Eliminação de Cálculo</Sub>
            <Sub onClick={()=>setMsg('Activar')}>Activar \ Desactivar Concorrentes Sorteio</Sub>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'2px 0'}}></div>
            <Sub onClick={()=>open('exportacaoConcorrentesWin')}>Exportação de Concorrentes</Sub>
            <Sub onClick={()=>open('exportacaoConcorrentesWin')}>Exportação de Sócios</Sub>
            <Sub onClick={()=>setMsg('Importacao')}>Importação de Concorrentes e Sócios</Sub>
          </div>}
        </div>
        <div style={s.menuItem(false)} onClick={()=>open('tabelaColectividades')}>Colectividades</div>
        <div style={s.menuItem(false)} onClick={()=>open('tabelaAssociacoes')}>Associações</div>
        <div style={{position:'relative'}}><div style={s.menuItem(menu==='param')} onClick={()=>setMenu(menu==='param'?null:'param')}>Parametrização</div>
          {menu==='param' && <div style={s.dropdown}>
            <Item onClick={()=>open('dadosPropriosWin')}>Dados Próprios</Item>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'2px 0'}}></div>
            <Item onClick={()=>open('configWin')}>Configuração da Aplicação</Item>
            <Item onClick={()=>open('config2Win')}>Configuração da Aplicação 2</Item>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'2px 0'}}></div>
            <Item onClick={()=>open('locaisSoltaWin')}>Tabela de Locais de Solta</Item>
            <Item onClick={()=>open('listagemDistanciasWin')}>Listagem de Distâncias</Item>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'2px 0'}}></div>
            <Item onClick={()=>open('horasMortasWin')}>Tabela de Horas Mortas</Item>
            <Item onClick={()=>setMsg('Listagem Tempos Mortos')}>Listagem de Tempos Mortos</Item>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'2px 0'}}></div>
            <Item onClick={()=>open('pontosPercWin')}>Pontos e Percentagens</Item>
            <Item onClick={()=>setMsg('Premios')}>Prémios a atribuir</Item>
          </div>}
        </div>
        <div style={{position:'relative'}}><div style={s.menuItem(menu==='utilitarios')} onClick={()=>setMenu(menu==='utilitarios'?null:'utilitarios')}>Utilitários</div>
          {menu==='utilitarios' && <div style={{...s.dropdown,minWidth:'360px'}}>
            <Sub onClick={()=>setMsg('Alterar Utilizador')}>Alterar Utilizador</Sub>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'2px 0'}}></div>
            <Sub onClick={()=>open('backupTotalWin')}>Cópia de Segurança Total</Sub>
            <Sub onClick={()=>open('backupDadosWin')}>Cópia de Segurança de Dados</Sub>
            <Sub onClick={()=>open('reposicaoWin')}>Reposição de Cópias</Sub>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'2px 0'}}></div>
            <Sub onClick={()=>setMsg('Cópia HTM')}>Cópia de ficheiros de Classificações em HTM</Sub>
            <Sub onClick={()=>setMsg('Reposição HTM')}>Reposição de ficheiros de Classificações em HTM</Sub>
            <Sub onClick={()=>setMsg('Visualizar HTM')}>Visualizar ficheiros de Classificações em HTM</Sub>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'2px 0'}}></div>
            <Sub onClick={()=>setMsg('Reconstrução')}>Reconstrução de ficheiros</Sub>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'2px 0'}}></div>
            <Sub onClick={()=>open('apagarCalculoWin')}>Apagar Cálculo de Prova</Sub>
            <Sub onClick={()=>open('apagarClassWin')}>Apagar Classificações de Prova</Sub>
            <Sub onClick={()=>open('apagarClassColectWin')}>Apagar Classificações de Colectividade</Sub>
            <Sub onClick={()=>open('apagarClassConcWin')}>Apagar Classificações de Concorrente</Sub>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'2px 0'}}></div>
            <Sub onClick={()=>setMsg('Transferencia')}>Transferência de Concorrente</Sub>
            <Sub onClick={()=>setMsg('Activar Pombo')}>Activar \ Desactivar Pombos por concorrente</Sub>
            <Sub onClick={()=>setMsg('Acerto')}>Acerto de dados de concorrente por prova</Sub>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'2px 0'}}></div>
            <Sub onClick={()=>setMsg('Copia Prova')}>Cópia de dados de uma Prova para Outra</Sub>
            <Sub onClick={()=>setMsg('Copia Programa')}>Cópia de Programa</Sub>
            <div style={{height:'1px',backgroundColor:'#808080',margin:'2px 0'}}></div>
            <Sub onClick={()=>setMsg('Testar')}>Testar Comunicações</Sub>
            <Sub onClick={()=>setMsg('Serializacao')}>Utilitário de Serialização</Sub>
          </div>}
        </div>
        <div style={s.menuItem(false)} onClick={()=>open('sobreWin')}>Sobre ...</div>
        <div style={s.menuItem(false)} onClick={()=>{ if(confirm('Sair do S.G.S.P?')) setMsg('Sessão encerrada'); }}>Sair</div>
      </div>

      <div style={s.toolbar}>
        <button style={s.tbtn} onClick={()=>open('lancamento')}>📋</button>
        <button style={s.tbtn} onClick={()=>open('calculo')}>🧮</button>
        <button style={s.tbtn} onClick={()=>open('pombosProva')}>📄</button>
        <button style={s.tbtn} onClick={()=>open('classificacao')}>🏆</button>
        <span style={{marginLeft:'auto',backgroundColor:'#fff',border:'2px inset #fff',padding:'2px 8px'}}>{concurso.ano} / {concurso.num} — {concurso.nome} — {concurso.tipo} — {concurso.enviados} enviados</span>
      </div>

      <div style={s.mdi}>

        {/* FUNDO */}
        {wins.length===0 && (
          <div style={{color:'#fff',textAlign:'center',marginTop:'60px'}}>
            <div style={{fontSize:'44px',fontWeight:'bold'}}>Sistema <span style={{color:'#7CFC00'}}>S.G.S.P</span></div>
            <div style={{color:'#ddd'}}>Gestão Columbófila</div>
            <div style={{height:'6px'}}></div>
          </div>
        )}

        {/* JANELA: LANÇAMENTO DE POMBOS NAS PROVAS - FIEL AO PRINT */}
        {wins.includes('lancamento') && (
          <div style={s.win}>
            <div style={s.winTitle}><span>Lançamento de Pombos nas Provas (V)</span><button onClick={()=>close('lancamento')} style={s.tbtn}>X</button></div>
            <div style={s.body}>
              <form onKeyDown={handleEnter} style={{display:'contents'}}>
              <div style={{display:'flex',gap:'6px',alignItems:'center',flexWrap:'wrap',marginBottom:'6px'}}>
                <label style={s.label}>Concurso :</label>
                <input value={concurso.ano} onChange={e=>setConcurso({...concurso,ano:e.target.value})} style={{...s.field,width:'50px',backgroundColor:'#e0f0ff',fontWeight:'bold'}} />
                <span>/</span>
                <input value={concurso.num} onChange={e=>setConcurso({...concurso,num:e.target.value})} style={{...s.field,width:'40px'}} />
                <button type="button" style={s.tbtn} onClick={()=>setLupaConcurso(true)} title="Pesquisar concurso">🔍</button>
                <input value={concurso.nome} onChange={e=>setConcurso({...concurso,nome:e.target.value})} style={{...s.field,flex:1}} />
              </div>

              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                <label style={s.label}>Anilha :</label>
                <input value={form.anilha} onKeyDown={handleEnter} onChange={e=>{
                  const v=maskAnilha(e.target.value);
                  // Busca socio fixo via pombosLista (anilha -> concorrente)
                  let autoConc='';
                  let autoAssoc='0';
                  const found = pombosLista.find(p=>p.anilha===v || p.anilha.replace('/','')===v.replace('/',''));
                  if(found){ autoConc=found.num; autoAssoc=found.assoc; }
                  else if(v.length>=7){
                    // tenta por prefixo
                    const f2=pombosLista.find(p=>p.anilha.startsWith(v.slice(0,5)));
                    if(f2){ autoConc=f2.num; autoAssoc=f2.assoc; }
                  }
                  if(autoConc) setForm({...form,anilha:v, concorrente:autoConc, assoc:autoAssoc});
                  else setForm({...form,anilha:v});
                }} placeholder="1234567/25" style={{...s.field,width:'110px'}} maxLength={10} />
                <button type="button" style={s.tbtn} onClick={()=>setLupaAnilha(true)} title="Pesquisar anilha">🔍</button>
                <div style={s.group}>
                  <span style={{fontWeight:'bold',fontSize:'10px'}}>Dados do Pombo</span>
                  <div style={{display:'flex',gap:'12px',alignItems:'center',marginTop:'4px',flexWrap:'wrap'}}>
                    <label>Sexo : <label><input type="radio" checked={form.sexo==='Macho'} onChange={()=>setForm({...form,sexo:'Macho'})} /> Macho</label> <label><input type="radio" checked={form.sexo==='Femea'} onChange={()=>setForm({...form,sexo:'Femea'})} /> Femea</label> <label><input type="radio" checked={form.sexo==='???'} onChange={()=>setForm({...form,sexo:'???'})} /> ????</label></label>
                    <label>Assc./Colec. : <input value={form.assoc} onChange={e=>setForm({...form,assoc:e.target.value})} style={{...s.field,width:'30px'}} /> <input style={{...s.field,width:'30px'}} /> <input style={{...s.field,width:'140px'}} /></label>
                    <label>Concorrente : <input value={form.concorrente} onChange={e=>setForm({...form,concorrente:e.target.value})} style={{...s.field,width:'50px'}} /> <button type="button" style={s.tbtn} onClick={()=>{setLupaTarget('formConcorrente'); setLupaConcorrente(true);}} title="Pesquisar concorrente">Lupa</button> <select value={form.concorrente} onChange={e=>setForm({...form,concorrente:e.target.value})} style={s.field}>{socios.map(sc=><option key={sc.id} value={sc.id}>{sc.lic} {sc.nome}</option>)}</select></label>
                  </div>
                </div>
              </div>

              <div style={{display:'flex',gap:'8px',marginBottom:'6px'}}>
                <div style={{...s.group,flex:1}}>
                  <div style={{fontWeight:'bold',textAlign:'center',fontSize:'10px'}}>Inicio de Relógio</div>
                  <div style={{display:'flex',gap:'4px',marginTop:'4px'}}>
                    <label>Data <input value={form.dataI} onKeyDown={handleEnter} onChange={e=>setForm({...form,dataI:maskData(e.target.value)})} placeholder="DD/MM/AAAA" style={{...s.field,width:'80px'}} maxLength={10} /></label>
                    <label>Hora <input value={form.horaI} onKeyDown={handleEnter} onChange={e=>setForm({...form,horaI:maskHora(e.target.value)})} placeholder="HH:MM:SS" style={{...s.field,width:'80px'}} maxLength={8} /></label>
                  </div>
                </div>
                <div style={{...s.group,flex:1}}>
                  <div style={{fontWeight:'bold',textAlign:'center',fontSize:'10px'}}>Final de Relógio</div>
                  <div style={{display:'flex',gap:'4px',marginTop:'4px'}}>
                    <label>Data <input value={form.dataF} onKeyDown={handleEnter} onChange={e=>setForm({...form,dataF:maskData(e.target.value)})} placeholder="DD/MM/AAAA" style={{...s.field,width:'80px'}} maxLength={10} /></label>
                    <label>Hora <input value={form.horaF} onKeyDown={handleEnter} onChange={e=>setForm({...form,horaF:maskHora(e.target.value)})} placeholder="HH:MM:SS" style={{...s.field,width:'80px'}} maxLength={8} /></label>
                  </div>
                </div>
                <div style={{...s.group,width:'110px'}}>
                  <div style={{fontWeight:'bold',textAlign:'center',fontSize:'10px'}}>Correcção</div>
                  <div style={{display:'flex',justifyContent:'center',marginTop:'4px'}}>
                    (+-) <input value={form.correcao} onChange={e=>setForm({...form,correcao:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                  </div>
                </div>
              </div>

              <div style={s.group}>
                <div style={{fontWeight:'bold',textAlign:'center',fontSize:'10px'}}>Dados de voo</div>
                <div style={{display:'flex',gap:'4px',alignItems:'center',marginTop:'4px',flexWrap:'wrap'}}>
                 <div style={{border:'1px solid #808080',padding:'2px 6px',backgroundColor:'#d4d0c8'}}>Dias+ <input value={form.diasCheg} onKeyDown={handleEnter} onChange={e=>setForm({...form,diasCheg:e.target.value.replace(/\D/g,'').slice(0,2)})} style={{...s.field,width:'30px',textAlign:'center'}} /></div>
                 <label>Chegada <input value={form.diaCheg} onKeyDown={handleEnter} onChange={e=>setForm({...form,diaCheg:maskHora(e.target.value)})} placeholder="HH:MM:SS" style={{...s.field,width:'80px'}} maxLength={8} /></label>
                 <label>Partida <input value={form.partida} onKeyDown={handleEnter} onChange={e=>setForm({...form,partida:maskHora(e.target.value)})} placeholder="HH:MM:SS" style={{...s.field,width:'80px'}} maxLength={8} /></label>
                 <label>Tempo Morto <input value={form.tempoMorto} onKeyDown={handleEnter} onChange={e=>setForm({...form,tempoMorto:maskHora(e.target.value)})} placeholder="HH:MM:SS" style={{...s.field,width:'80px'}} maxLength={8} /></label>
                 <label>+- Correcção <input value={form.corr2} onKeyDown={handleEnter} onChange={e=>setForm({...form,corr2:e.target.value})} style={{...s.field,width:'40px'}} /> = <input value={form.tempoVoo} onKeyDown={handleEnter} onChange={e=>setForm({...form,tempoVoo:e.target.value})} style={{...s.field,width:'80px',backgroundColor:'#e8e8e8'}} /></label>
                </div>
                <div style={{display:'flex',gap:'12px',marginTop:'6px'}}>
                  <label>Distância : <input value={form.distancia} readOnly style={{...s.field,width:'90px',fontWeight:'bold',backgroundColor:'#e8f0ff'}} /> (em metros)</label>
                  <label>Média : <input value={form.media} readOnly style={{...s.field,width:'90px',fontWeight:'bold',color:'#000080'}} /> (metros/minuto)</label>
                </div>
              </div>

              <div style={s.group}>
                <div style={{fontWeight:'bold',fontSize:'10px',marginBottom:'4px'}}>Campeonatos : Anilhas | Designados | Equipas | C. Sec. | Federação</div>
                <div style={{display:'flex',gap:'8px'}}>
                  {[
                    {k:'anilhas',l:'S/N'},
                    {k:'designados',l:'S/N'},
                    {k:'equipas',l:'S/N'},
                    {k:'csec',l:'S/N'},
                    {k:'feder',l:'S/N'},
                  ].map(it=>(
                    <div key={it.k} style={{border:'1px solid #808080',padding:'4px 8px',backgroundColor:'#d4d0c8',textAlign:'center',minWidth:'60px'}}>
                      <div style={{fontSize:'10px',fontWeight:'bold'}}>{it.l}</div>
                      <div style={{display:'flex',gap:'8px',justifyContent:'center',marginTop:'2px'}}>
                        <label><input type="radio" checked={form[it.k]===true} onChange={()=>setForm({...form,[it.k]:true})} /> ○</label>
                        <label><input type="radio" checked={form[it.k]===false} onChange={()=>setForm({...form,[it.k]:false})} /> ○</label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{display:'flex',gap:'6px'}}>
                <div style={{flex:1,backgroundColor:'#fff',border:'2px inset #fff',height:'90px',overflowY:'auto',padding:'4px'}}>
                  <div style={{fontWeight:'bold',fontSize:'10px',backgroundColor:'#000080',color:'#fff',padding:'2px 4px',display:'flex',justifyContent:'space-between'}}><span>Pombos introduzidos</span><span>Anilha | HoraCheg</span></div>
                  {anilhasLancadas.length===0 && <div style={{fontSize:'10px',color:'#808080',textAlign:'center',padding:'6px'}}>Nenhum pombo lançado — digite Anilha e clique Novo</div>}
                  {anilhasLancadas.map((a,i)=>(<div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:'11px',padding:'1px 4px',borderBottom:'1px solid #eee',backgroundColor:i%2?'#f0f0f0':'#fff'}}><span>{a.anilha}</span><span style={{display:'flex',gap:'6px',alignItems:'center'}}>{a.hora} <button type="button" title="Excluir pombo" onClick={()=>{ setAnilhasLancadas(anilhasLancadas.filter((_,idx)=>idx!==i)); setMsg('Pombo '+a.anilha+' excluído'); }} style={{...s.tbtn,padding:'0 3px',fontSize:'10px',color:'#c00',border:'1px solid #c00'}}>✕</button></span></div>))}
                </div>
              </div>

              <div style={{display:'flex',justifyContent:'center',gap:'6px',marginTop:'8px',flexWrap:'wrap'}}>
                <button type="button" style={s.btn} onClick={()=>{ if(!form.anilha) return setMsg('Informe Anilha'); setAnilhasLancadas([...anilhasLancadas,{anilha:form.anilha,hora:form.diaCheg||'12:00:00'}]); setForm({...form,anilha:''}); setMsg('Pombo lançado — '+anilhasLancadas.length+1+' pombos'); }}>📄 Novo</button>
                <button type="button" style={s.btn} onClick={()=>setMsg('Guardado — '+anilhasLancadas.length+' pombos — Movimentos → Cálculo de Prova para apurar')}>💾 Guardar</button>
                <button type="button" style={s.btn} onClick={()=>{ if(form.anilha || form.concorrente){ setForm({...form,anilha:'',concorrente:'',distancia:'',media:''}); setMsg('Formulário desfeito'); }}}>↩️ Desfazer</button>
                <button type="button" style={{...s.btn,backgroundColor:'#ffc0c0'}} onClick={()=>{ if(anilhasLancadas.length===0) return setMsg('Nenhum pombo para anular'); if(confirm('Anular último pombo '+anilhasLancadas[anilhasLancadas.length-1].anilha+'?')){ setAnilhasLancadas(anilhasLancadas.slice(0,-1)); setMsg('Último pombo anulado'); } }}>❌ Anular</button>
                <button type="button" style={{...s.btn,backgroundColor:'#ffffc0'}} onClick={()=>close('lancamento')}>📁 Sair</button>
              </div>
              </form>
              <div style={{marginTop:'6px',display:'flex',justifyContent:'space-between',fontSize:'10px',backgroundColor:'#d4d0c8',border:'1px solid #808080',padding:'2px 6px'}}>
                <span>Pombos do Concorrente: {anilhasLancadas.length}</span><span>Pombos na Prova: {anilhasLancadas.length}</span>
              </div>
              {/* Lupas */}
              {lupaConcurso && <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}} onClick={()=>setLupaConcurso(false)}>
                <div style={{backgroundColor:'#c0c0c0',border:'2px outset #fff',width:'420px',padding:'8px'}} onClick={e=>e.stopPropagation()}>
                  <div style={{...s.winTitle,margin:'-8px -8px 8px -8px'}}><span>🔍 Pesquisar Concurso</span><button style={s.tbtn} onClick={()=>setLupaConcurso(false)}>X</button></div>
                  {concursosLista.map(c=><div key={c.ano+'/'+c.num} onClick={()=>{
                    if(lupaTarget==='pombosFeConcurso'){ setPombosFe({...pombosFe,ano:c.ano,num:c.num,nome:c.nome}); }
                    else if(lupaTarget==='listConcDe'){ setListConcParams({...listConcParams,deAno:c.ano,deNum:c.num}); }
                    else if(lupaTarget==='listConcAte'){ setListConcParams({...listConcParams,ateAno:c.ano,ateNum:c.num}); }
                    else if(lupaTarget==='distDe'){ setDistParams({...distParams,deAno:c.ano,deNum:c.num}); }
                    else if(lupaTarget==='distAte'){ setDistParams({...distParams,ateAno:c.ano,ateNum:c.num}); }
                    else if(lupaTarget==='pombosEnvConcurso'){ setPombosEnv({...pombosEnv,ano:c.ano,num:c.num}); }
                    else { selecionarConcursoGlobal(c); }
                    setLupaConcurso(false);
                  }} style={{padding:'6px',borderBottom:'1px solid #808080',cursor:'pointer',backgroundColor:'#fff'}}>{c.ano}/{c.num} — {c.nome} — {c.data} — {c.tipo}</div>)}
                  <div style={{height:'1px',backgroundColor:'#808080',margin:'4px 0'}}></div>
                  {locais.map(l=><div key={l.id} onClick={()=>{setConcurso({...concurso,ano:'2025',num:'16',nome:l.nome}); setLupaConcurso(false); setMsg(`Concurso selecionado: ${l.nome}`);}} style={{padding:'6px',borderBottom:'1px solid #808080',cursor:'pointer',backgroundColor:'#fff',fontSize:'10px',color:'#000080'}}>{l.nome} — Locais de Solta {l.lat.toFixed(4)},{l.lon.toFixed(4)}</div>)}
                  <div style={{textAlign:'right',marginTop:'8px'}}><button style={s.btn} onClick={()=>setLupaConcurso(false)}>Sair</button></div>
                </div></div>}
              {lupaAnilha && <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}} onClick={()=>setLupaAnilha(false)}>
                <div style={{backgroundColor:'#c0c0c0',border:'2px outset #fff',width:'420px',padding:'8px'}} onClick={e=>e.stopPropagation()}>
                  <div style={{...s.winTitle,margin:'-8px -8px 8px -8px'}}><span>🔍 Pesquisar Anilha</span><button style={s.tbtn} onClick={()=>setLupaAnilha(false)}>X</button></div>
                  {socios.slice(0,5).map(sc=><div key={sc.id} onClick={()=>{setForm({...form,anilha:'113464221',concorrente:String(sc.id)}); setLupaAnilha(false);}} style={{padding:'6px',borderBottom:'1px solid #808080',cursor:'pointer',backgroundColor:'#fff'}}>{sc.lic} — {sc.nome} — Anilhas disponíveis</div>)}
                  <div style={{textAlign:'right',marginTop:'8px'}}><button style={s.btn} onClick={()=>setLupaAnilha(false)}>Sair</button></div>
                </div></div>}
            </div>
          </div>
        )}

        {/* CALCULO DA PROVA */}
        {wins.includes('calculo') && (
          <div style={s.win}>
            <div style={s.winTitle}><span>Cálculo da Prova</span><button onClick={()=>close('calculo')} style={s.tbtn}>X</button></div>
            <div style={s.body}>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                <label>Do concurso :</label>
                <input value={concurso.ano} onChange={e=>setConcurso({...concurso,ano:e.target.value})} style={{...s.field,width:'50px',backgroundColor:'#b0d0ff',fontWeight:'bold'}} />
                <input value={concurso.num} onChange={e=>setConcurso({...concurso,num:e.target.value})} style={{...s.field,width:'40px'}} />
                <button style={s.tbtn} onClick={()=>setLupaConcurso(true)} title="Pesquisar concurso">🔍</button>
                <input value={concurso.nome} style={{...s.field,flex:1,backgroundColor:'#e8e8e8',fontWeight:'bold'}} readOnly />
              </div>
              <div style={{border:'2px groove #fff',padding:'6px',marginBottom:'6px'}}>
                <div style={{fontWeight:'bold',textAlign:'center',marginBottom:'6px'}}>Dados do Concurso</div>
                <div style={{display:'grid',gridTemplateColumns:'80px 140px 80px 140px',gap:'6px',alignItems:'center'}}>
                  <label>Tipo :</label><input value={concurso.tipo} style={{...s.field,backgroundColor:'#ffd0d0',color:'#800000',fontWeight:'bold',textAlign:'center'}} readOnly />
                  <label>Latitude :</label><input value={concurso.lat} style={{...s.field,backgroundColor:'#e8e8e8'}} readOnly />
                  <label>Data :</label><input value={concurso.data} style={{...s.field,backgroundColor:'#e8e8e8'}} readOnly />
                  <label>Longitude :</label><input value={concurso.lon} style={{...s.field,backgroundColor:'#e8e8e8'}} readOnly />
                  <label>Pombos Enviados :</label><input value={concurso.enviados} style={{...s.field,fontWeight:'bold',textAlign:'center'}} readOnly />
                  <span></span><span></span>
                </div>
              </div>
              <div style={{border:'2px groove #fff',padding:'8px',backgroundColor:'#d4d0c8'}}>
                <div style={{display:'flex',flexDirection:'column',gap:'3px',fontSize:'11px'}}>
                  <div style={steps.apagar?s.checkOk:{}}>{steps.apagar?'✅':'⬜'} Apagar cálculo anterior</div>
                  <div style={steps.dist?s.checkOk:{}}>{steps.dist?'✅':'⬜'} Calcular distância</div>
                  <div style={steps.preencher?s.checkOk:{}}>{steps.preencher?'✅':'⬜'} Preencher dados para cálculo</div>
                  <div style={steps.tempo?s.checkOk:{}}>{steps.tempo?'✅':'⬜'} Calcular tempo de voo e média</div>
                  <div style={steps.lugares?s.checkOk:{}}>{steps.lugares?'✅':'⬜'} Cálculo dos Lugares</div>
                  <div style={steps.premios?s.checkOk:{}}>{steps.premios?'✅':'⬜'} Cálculo dos Prémios</div>
                  <div style={steps.coef?s.checkOk:{}}>{steps.coef?'✅':'⬜'} Cálculo dos Coeficientes</div>
                  <div style={{marginTop:'6px',fontWeight:'bold'}}>{steps.sec?'✅':''} Campeonatos Secundários</div>
                </div>
              </div>
              {calcDone && (
                <div style={{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',backgroundColor:'#d4d0c8',border:'2px outset #fff',padding:'12px',boxShadow:'4px 4px 12px rgba(0,0,0,0.6)',width:'320px',zIndex:60}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontWeight:'bold',backgroundColor:'#000080',color:'#fff',padding:'3px 6px',margin:'-12px -12px 10px -12px'}}><span>Informação</span><span onClick={()=>setCalcDone(false)} style={{cursor:'pointer'}}>X</span></div>
                  <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
                    <span style={{fontSize:'24px'}}>ℹ️</span>
                    <span>Procedimento Terminado sem Anomalias</span>
                  </div>
                  <div style={{textAlign:'right',marginTop:'10px'}}><button style={s.btn} onClick={()=>setCalcDone(false)}>OK</button></div>
                </div>
              )}
              <div style={{display:'flex',justifyContent:'center',gap:'12px',marginTop:'8px'}}>
                <button style={s.btn} onClick={rodarCalculo}>▶️ Confirmar</button>
                <button style={s.btn} onClick={()=>close('calculo')}>📁 Sair</button>
              </div>
            </div>
          </div>
        )}

        {/* CLASSIFICAÇÃO DE CONCORRENTES / DESIGNADOS */}
        {wins.includes('classificacao') && (
          <div style={s.win}>
            <div style={s.winTitle}><span>Classificação de Concorrentes / Designados</span><button onClick={()=>close('classificacao')} style={s.tbtn}>X</button></div>
            <div style={s.body}>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                <label>Do concurso :</label><input value={concurso.ano} style={{...s.field,width:'50px',backgroundColor:'#b0d0ff',fontWeight:'bold'}} readOnly /><input value={concurso.num} style={{...s.field,width:'40px'}} readOnly /><input value={concurso.nome} style={{...s.field,flex:1}} readOnly />
              </div>
              <div style={{border:'2px groove #fff',padding:'6px'}}>
                <div style={{display:'grid',gridTemplateColumns:'80px 140px 80px 140px',gap:'6px'}}>
                  <label>Tipo :</label><input value={concurso.tipo} style={{...s.field,backgroundColor:'#ffd0d0',fontWeight:'bold',textAlign:'center',color:'#800000'}} readOnly />
                  <label>Latitude :</label><input value={concurso.lat} style={{...s.field,backgroundColor:'#e8e8e8'}} readOnly />
                  <label>Data :</label><input value={concurso.data} style={{...s.field,backgroundColor:'#e8e8e8'}} readOnly />
                  <label>Longitude :</label><input value={concurso.lon} style={{...s.field,backgroundColor:'#e8e8e8'}} readOnly />
                  <label>Pombos Enviados :</label><input value={concurso.enviados} style={{...s.field}} readOnly />
                </div>
                <div style={{marginTop:'6px',display:'flex',gap:'12px',alignItems:'center'}}>
                  <label>Com classificação de pombos ? <label><input type="radio" checked={classParams.comPombos==='Não'} onChange={()=>setClassParams({...classParams,comPombos:'Não'})} /> Não</label> <label><input type="radio" checked={classParams.comPombos==='Sim'} onChange={()=>setClassParams({...classParams,comPombos:'Sim'})} /> Sim</label></label>
                </div>
                <div style={{display:'flex',gap:'8px',marginTop:'6px',alignItems:'center'}}>
                  <label>Os melhores : <input value={classParams.melhores} onChange={e=>setClassParams({...classParams,melhores:e.target.value})} style={{...s.field,width:'70px'}} /> </label>
                  <label>Realçar os <input value={classParams.realcar} style={{...s.field,width:'40px'}} /> melhores</label>
                </div>
                <div style={{border:'2px groove #fff',padding:'6px',marginTop:'6px'}}>
                  <div style={{fontWeight:'bold',textAlign:'center'}}>Parâmetros</div>
                  <div style={{display:'flex',gap:'8px',marginTop:'4px',flexWrap:'wrap'}}>
                    <label>Destino : <label><input type="radio" checked={classParams.destino==='Impressora'} onChange={()=>setClassParams({...classParams,destino:'Impressora'})} /> Impressora</label> <label><input type="radio" checked={classParams.destino==='Ficheiro Excel'} onChange={()=>setClassParams({...classParams,destino:'Ficheiro Excel'})} /> Ficheiro Excel</label> <input placeholder="C:\SGSP\EXP\" style={{...s.field,width:'140px'}} /></label>
                    <label>Da página <input value={classParams.daPag} style={{...s.field,width:'40px'}} /> à página <input value={classParams.atePag} style={{...s.field,width:'50px'}} /> Cópias <input value={classParams.copias} style={{...s.field,width:'40px'}} /></label>
                  </div>
                </div>
                <div style={{display:'flex',justifyContent:'center',gap:'12px',marginTop:'8px'}}>
                  <button style={s.btn} onClick={()=>open('relatorio')}>▶️ Confirmar</button>
                  <button style={s.btn} onClick={()=>close('classificacao')}>📁 Sair</button>
                </div>
              </div>
            </div>
          </div>
        )}

                {/* POMBOS NA PROVA - PARAMETROS */}
        {wins.includes('pombosProva') && (
          <div style={s.win}>
            <div style={s.winTitle}><span>Pombos na Prova</span><button onClick={()=>close('pombosProva')} style={s.tbtn}>X</button></div>
            <div style={s.body}>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                <label>Do concurso :</label><input value={concurso.ano} style={{...s.field,width:'50px',backgroundColor:'#b0d0ff',fontWeight:'bold'}} readOnly /><input value={concurso.num} style={{...s.field,width:'40px'}} readOnly /><input value={concurso.nome} style={{...s.field,flex:1,fontWeight:'bold'}} readOnly />
              </div>
              <div style={{border:'2px groove #fff',padding:'6px'}}>
                <div style={{display:'grid',gridTemplateColumns:'80px 140px 80px 140px',gap:'6px'}}>
                  <label>Tipo :</label><input value={concurso.tipo} style={{...s.field,backgroundColor:'#ffd0d0',fontWeight:'bold',textAlign:'center',color:'#800000'}} readOnly />
                  <label>Latitude :</label><input value={concurso.lat} style={{...s.field,backgroundColor:'#e8e8e8'}} readOnly />
                  <label>Data :</label><input value={concurso.data} style={{...s.field,backgroundColor:'#e8e8e8'}} readOnly />
                  <label>Longitude :</label><input value={concurso.lon} style={{...s.field,backgroundColor:'#e8e8e8'}} readOnly />
                  <label>Pombos Enviados :</label><input value={concurso.enviados} style={{...s.field}} readOnly />
                </div>
                <div style={{display:'flex',gap:'8px',marginTop:'8px',flexWrap:'wrap'}}>
                  <label>Os melhores : <input value={classParams.melhores} style={{...s.field,width:'70px'}} /></label>
                  <label>Pombos com zero pontos ? <label><input type="radio" /> Não</label> <label><input type="radio" /> Sim</label></label>
                  <label>Formato : <label><input type="radio" defaultChecked /> Tudo</label> <label><input type="radio" /> Justa</label></label>
                  <label>Com prémios? <label><input type="radio" defaultChecked /> Não</label> <label><input type="radio" /> Sim</label></label>
                </div>
                <div style={{border:'2px groove #fff',padding:'6px',marginTop:'6px'}}>
                  <div style={{fontWeight:'bold',textAlign:'center'}}>Parâmetros</div>
                  <div style={{display:'flex',gap:'8px',marginTop:'4px'}}>
                    <label>Da página <input value="1" style={{...s.field,width:'40px'}} /> à página <input value="9999" style={{...s.field,width:'50px'}} /> Cópias <input value="1" style={{...s.field,width:'40px'}} /></label>
                    <label>Destino : <label><input type="radio" defaultChecked /> Impressora</label> <label><input type="radio" /> Ficheiro Excel</label> <input placeholder="C:\SGSP\EXP\" style={{...s.field,width:'120px'}} /></label>
                  </div>
                </div>
                <div style={{display:'flex',justifyContent:'center',gap:'12px',marginTop:'8px'}}>
                  <button style={s.btn} onClick={()=>open('relatorioPombos')}>▶️ Confirmar</button>
                  <button style={s.btn} onClick={()=>close('pombosProva')}>📁 Sair</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RELATORIOS GERADOS */}
        {wins.includes('relatorio') && (
          <div style={{...s.win,width:'950px'}}>
            <div style={s.winTitle}><span>CLUBE COLUMBÓFILO LIMEIRENSE — Classificação de Concorrentes - Designados</span><button onClick={()=>close('relatorio')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,backgroundColor:'#fff',fontFamily:'Arial',fontSize:'11px'}}>
              <div style={{textAlign:'center',fontWeight:'bold',color:'#008080',fontSize:'14px'}}>CLUBE COLUMBÓFILO LIMEIRENSE</div>
              <div style={{textAlign:'center',fontWeight:'bold',marginBottom:'8px'}}>Classificação de Concorrentes - Designados</div>
              <div style={{border:'1px solid #000',padding:'6px',fontSize:'11px'}}>
                <div style={{display:'flex',justifyContent:'space-between'}}><span style={{backgroundColor:'#c0c0c0',padding:'1px 6px',fontWeight:'bold'}}>Concurso: 2025 / 16</span><span><b>Nome:</b> Brasilia-DF</span></div>
                <div style={{display:'flex',justifyContent:'space-between',marginTop:'4px'}}><span><b>Data:</b> 20/09/2025</span><span><b>Tipo:</b> Fundo</span></div>
                <div style={{display:'flex',justifyContent:'space-between'}}><span><b>Hora solta:</b> 06:35:00</span><span><b>Tempo morto:</b> 10:52:00 - 00:00:00 - 00:00:00</span></div>
                <div style={{display:'flex',justifyContent:'space-between'}}><span><b>Latitude:</b> 015-42-01.1</span><span><b>Longitude:</b> 047-48-39.0</span></div>
                <div style={{display:'flex',justifyContent:'space-between'}}><span><b>Enviados :</b> 300</span><span><b>Designados :</b> 0 &nbsp; <b>NºConcorrentes :</b> 7</span></div>
                <table style={{width:'100%',borderCollapse:'collapse',marginTop:'8px',fontSize:'10px'}}>
                  <thead><tr style={{backgroundColor:'#c0c0c0'}}><th style={{border:'1px solid #000',padding:'3px'}}>Lugar</th><th style={{border:'1px solid #000',padding:'3px'}}>Concorrente</th><th style={{border:'1px solid #000',padding:'2px',backgroundColor:'#c0e0ff'}}>VELOCIDADE</th><th style={{border:'1px solid #000',padding:'2px',backgroundColor:'#d0ffd0'}}>MEIO-FUNDO</th><th style={{border:'1px solid #000',padding:'2px',backgroundColor:'#ffe0c0'}}>FUNDO</th><th style={{border:'1px solid #000',padding:'2px',backgroundColor:'#fffacd'}}>FILHOTES</th><th style={{border:'1px solid #000',padding:'3px',backgroundColor:'#ffff00'}}>GERAL</th></tr></thead>
                  <tbody>{classDados.map(r=><tr key={r.lugar}><td style={{border:'1px solid #000',padding:'2px 6px',textAlign:'center'}}>{r.lugar}</td><td style={{border:'1px solid #000',padding:'2px 6px'}}>{r.concorrente}</td><td style={{border:'1px solid #000',padding:'2px 6px',textAlign:'center',backgroundColor:'#c0e0ff'}}>{r.veloc}</td><td style={{border:'1px solid #000',padding:'2px 6px',textAlign:'center',backgroundColor:'#d0ffd0'}}>{r.meio}</td><td style={{border:'1px solid #000',padding:'2px 6px',textAlign:'center',backgroundColor:'#ffe0c0'}}>{r.fundo}</td><td style={{border:'1px solid #000',padding:'2px 6px',textAlign:'center',backgroundColor:'#fffacd'}}>{r.filh||'-'}</td><td style={{border:'1px solid #000',padding:'2px 6px',textAlign:'right',fontWeight:'bold',backgroundColor:'#ffffc0'}}>{r.pontos}</td></tr>)}</tbody>
                </table>
                <div style={{fontSize:'9px',color:'#800000',marginTop:'4px',textAlign:'center'}}>Classificação por categorias: VELOCIDADE (até 300km) • MEIO-FUNDO (300-500km) • FUNDO (500-800km) • FILHOTES • GERAL = soma todas</div>
              </div>
            </div>
          </div>
        )}

        {wins.includes('relatorioPombos') && (
          <div style={{...s.win,width:'900px'}}>
            <div style={s.winTitle}><span>CLUBE COLUMBÓFILO LIMEIRENSE — Pombos na Prova</span><button onClick={()=>close('relatorioPombos')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,backgroundColor:'#fff',fontFamily:'Arial',fontSize:'10px'}}>
              <div style={{textAlign:'center',fontWeight:'bold',color:'#008080',fontSize:'14px'}}>CLUBE COLUMBÓFILO LIMEIRENSE</div>
              <div style={{textAlign:'center',fontWeight:'bold',marginBottom:'6px'}}>Pombos na Prova</div>
              <div style={{border:'1px solid #000',padding:'4px'}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px'}}><span style={{backgroundColor:'#c0c0c0',padding:'1px 4px',fontWeight:'bold'}}>Concurso: 2025 / 16</span><span><b>Nome:</b> Brasilia-DF <b>Data:</b> 20/09/2025 <b>Tipo:</b> Fundo</span></div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px'}}><span><b>Hora solta:</b> 06:35:00</span><span><b>Lat:</b> 015-42-01.1 <b>Lon:</b> 047-48-39.0 <b>Enviados:</b> 300 <b>NºConcorrentes:</b> 7 <b>A classificar:</b> 300</span></div>
                <table style={{width:'100%',borderCollapse:'collapse',marginTop:'6px',fontSize:'9px'}}>
                  <thead><tr style={{backgroundColor:'#c0c0c0'}}><th style={{border:'1px solid #000'}}>Clas</th><th style={{border:'1px solid #000'}}>Anilha</th><th style={{border:'1px solid #000'}}>P D E</th><th style={{border:'1px solid #000'}}>Concorrente</th><th style={{border:'1px solid #000'}}>Cheg</th><th style={{border:'1px solid #000'}}>Caixa</th><th style={{border:'1px solid #000'}}>Dist.</th><th style={{border:'1px solid #000'}}>Média</th><th style={{border:'1px solid #000'}}>Pontos</th></tr></thead>
                  <tbody>{pombosProva.map(r=><tr key={r.cls}><td style={{border:'1px solid #000',textAlign:'center'}}>{r.cls}</td><td style={{border:'1px solid #000'}}>{r.anilha}</td><td style={{border:'1px solid #000',textAlign:'center'}}>{r.p} {r.d} {r.e}</td><td style={{border:'1px solid #000'}}>{r.concorrente}</td><td style={{border:'1px solid #000'}}>{r.cheg}</td><td style={{border:'1px solid #000',textAlign:'center'}}>{r.caixa}</td><td style={{border:'1px solid #000'}}>{r.dist}</td><td style={{border:'1px solid #000'}}>{r.media}</td><td style={{border:'1px solid #000',textAlign:'center'}}>{r.pontos}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* EXPORT GPB */}
        {wins.includes('exportGPB') && (
          <div style={s.win}>
            <div style={s.winTitle}><span>Exportação de Movimentos para Sistema S.G.S.P</span><button onClick={()=>close('exportGPB')} style={s.tbtn}>X</button></div>
            <div style={s.body}>
              <div style={{textAlign:'center',color:'#000080',fontWeight:'bold',marginBottom:'8px'}}>Vai proceder à exportação de dados<br/>de movimentos e recenseamento para sistema GPB.</div>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'8px'}}>
                <label>Do concorrente</label>
                <input value={expGPB.a} onChange={e=>setExpGPB({...expGPB,a:e.target.value})} style={{...s.field,width:'30px',backgroundColor:'#e0f0ff'}} />
                <input value={expGPB.b} onChange={e=>setExpGPB({...expGPB,b:e.target.value})} style={{...s.field,width:'30px'}} />
                <input value={expGPB.c} onChange={e=>setExpGPB({...expGPB,c:e.target.value})} style={{...s.field,width:'40px'}} />
                <input value={expGPB.nome} onChange={e=>setExpGPB({...expGPB,nome:e.target.value})} style={{...s.field,flex:1,backgroundColor:'#e8e8e8'}} />
              </div>
              <div style={{border:'1px solid #808080',padding:'6px',marginBottom:'6px'}}>
                <div style={{display:'flex',gap:'12px'}}>
                  <label>Destino :</label><label><input type="radio" checked={expGPB.destino==='Disquete'} onChange={()=>setExpGPB({...expGPB,destino:'Disquete'})} /> Disquete</label><label><input type="radio" checked={expGPB.destino==='Outra Localização'} onChange={()=>setExpGPB({...expGPB,destino:'Outra Localização'})} /> Outra Localização</label><label><input type="radio" checked={expGPB.destino==='Internet'} onChange={()=>setExpGPB({...expGPB,destino:'Internet'})} /> Internet</label>
                </div>
                <div style={{marginTop:'6px',display:'flex',gap:'6px',alignItems:'center'}}><label>Localização :</label><input value={expGPB.loc} onChange={e=>setExpGPB({...expGPB,loc:e.target.value})} style={{...s.field,flex:1}} /></div>
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'12px'}}><button style={s.btn} onClick={()=>{
                const conteudo=`CLUBE COLUMBOFILO - EXPORTACAO GPB\nDo concorrente: ${expGPB.a}/${expGPB.b}/${expGPB.c} ${expGPB.nome}\nDestino: ${expGPB.destino} Local: ${expGPB.loc}\nPombos: ${anilhasLancadas.map(a=>a.anilha).join(', ')}\n`;
                const blob=new Blob([conteudo],{type:'text/plain'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`EXP_GPB_${expGPB.a}_${expGPB.b}_${expGPB.c}.txt`; a.click(); URL.revokeObjectURL(url);
                setMsg(`Exportacao GPB gerada: EXP_GPB_${expGPB.a}_${expGPB.b}_${expGPB.c}.txt`); close('exportGPB');
              }}>Confirmar</button><button style={s.btn} onClick={()=>close('exportGPB')}>Sair</button></div>
            </div>
          </div>
        )}
        {wins.includes('exportTotal') && (
          <div style={s.win}>
            <div style={s.winTitle}><span>Exportação de Total de Movimentos</span><button onClick={()=>close('exportTotal')} style={s.tbtn}>X</button></div>
            <div style={s.body}>
              <div style={{textAlign:'center',color:'#000080',fontWeight:'bold',marginBottom:'8px'}}>Vai proceder à exportação total de dados<br/>de movimentos.</div>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                <label>Do concurso</label><input value={expTotal.ano} onChange={e=>setExpTotal({...expTotal,ano:e.target.value})} style={{...s.field,width:'40px',backgroundColor:'#b0d0ff'}} />/<input value={expTotal.num} onChange={e=>setExpTotal({...expTotal,num:e.target.value})} style={{...s.field,width:'30px'}} /><input style={{...s.field,flex:1}} />
              </div>
              <div style={{border:'1px solid #808080',padding:'6px',display:'flex',gap:'10px',alignItems:'center'}}>
                <label>Destino :</label><label><input type="radio" checked={expTotal.destino==='Disquete'} onChange={()=>setExpTotal({...expTotal,destino:'Disquete'})} /> Disquete</label><label><input type="radio" checked={expTotal.destino==='Outra Localização'} onChange={()=>setExpTotal({...expTotal,destino:'Outra Localização'})} /> Outra Localização</label><label>Localização :</label><input value={expTotal.loc} onChange={e=>setExpTotal({...expTotal,loc:e.target.value})} style={{...s.field,flex:1}} />
              </div>
              <div style={{color:'#800000',fontWeight:'bold',fontSize:'10px',marginTop:'6px'}}>NOTA: um(a) ficheiro/disquete por concurso.</div>
              <div style={{display:'flex',justifyContent:'center',gap:'12px',marginTop:'8px'}}><button style={s.btn} onClick={()=>{
                const conteudo=`CLUBE COLUMBOFILO - EXPORTACAO TOTAL\nConcurso: ${expTotal.ano}/${expTotal.num} ${concurso.nome}\nData: ${concurso.data} Tipo: ${concurso.tipo}\n${anilhasLancadas.map(a=>`${a.anilha};${a.hora};${concurso.nome}`).join('\n')}\nGerado: ${new Date().toLocaleString()}\n`;
                const blob=new Blob([conteudo],{type:'text/plain'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`EXP_TOTAL_${expTotal.ano||concurso.ano}_${expTotal.num||concurso.num}.txt`; a.click(); URL.revokeObjectURL(url);
                setMsg(`Exportacao Total gerada: EXP_TOTAL_${expTotal.ano||concurso.ano}_${expTotal.num||concurso.num}.txt (${anilhasLancadas.length} pombos)`); close('exportTotal');
              }}>Confirmar</button><button style={s.btn} onClick={()=>close('exportTotal')}>Sair</button></div>
            </div>
          </div>
        )}
        {wins.includes('pomboAs') && (
          <div style={s.win}>
            <div style={s.winTitle}><span>Análise Classificações - Pombo Ás</span><button onClick={()=>close('pomboAs')} style={s.tbtn}>X</button></div>
            <div style={s.body}>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                <label>Ano :</label><input value={pomboAs.ano} onChange={e=>setPomboAs({...pomboAs,ano:e.target.value})} style={{...s.field,width:'60px',backgroundColor:'#b0d0ff',fontWeight:'bold',textAlign:'center'}} />
                <span style={{marginLeft:'12px'}}>Do concurso :</span><input value={pomboAs.de} onChange={e=>setPomboAs({...pomboAs,de:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                <span>ao concurso :</span><input value={pomboAs.ate} onChange={e=>setPomboAs({...pomboAs,ate:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                <span style={{flex:1,backgroundColor:'#e8e8e8',border:'2px inset #fff',padding:'2px 6px'}}>{concurso.nome} — {pomboAs.de} a {pomboAs.ate}</span>
              </div>
              <div style={{border:'2px groove #fff',padding:'6px',marginBottom:'6px'}}>
                <div style={{fontWeight:'bold',textAlign:'center',marginBottom:'6px'}}>Parâmetros Pombo Ás</div>
                <div style={{display:'grid',gridTemplateColumns:'110px 1fr',gap:'6px',alignItems:'center'}}>
                  <label>Categoria :</label>
                  <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>{['VELOCIDADE','MEIO-FUNDO','FUNDO','GRANDE FUNDO','FILHOTES','GERAL'].map(c=> <label key={c}><input type="radio" checked={pomboAs.categoria===c} onChange={()=>setPomboAs({...pomboAs,categoria:c})} /> {c}</label>)}</div>
                  <label>Critério :</label>
                  <div style={{display:'flex',gap:'12px'}}><label><input type="radio" checked={pomboAs.criterio==='Coeficiente'} onChange={()=>setPomboAs({...pomboAs,criterio:'Coeficiente'})} /> Coeficiente (menor vence)</label><label><input type="radio" checked={pomboAs.criterio==='Pontos'} onChange={()=>setPomboAs({...pomboAs,criterio:'Pontos'})} /> Pontos (maior vence)</label></div>
                  <label>Mínimo de provas :</label><input value={pomboAs.minimo} onChange={e=>setPomboAs({...pomboAs,minimo:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                  <label>Tipo de Provas :</label>
                  <div style={{display:'flex',gap:'10px'}}><label><input type="radio" checked={pomboAs.tipoProva==='Oficiais'} onChange={()=>setPomboAs({...pomboAs,tipoProva:'Oficiais'})} /> Oficiais</label><label><input type="radio" checked={pomboAs.tipoProva==='Não Oficiais'} onChange={()=>setPomboAs({...pomboAs,tipoProva:'Não Oficiais'})} /> Não Oficiais</label><label><input type="radio" checked={pomboAs.tipoProva==='Todas'} onChange={()=>setPomboAs({...pomboAs,tipoProva:'Todas'})} /> Todas</label></div>
                </div>
                <div style={{border:'1px solid #808080',padding:'4px',marginTop:'8px',display:'flex',gap:'12px',alignItems:'center'}}>
                  <label>Destino :</label><label><input type="radio" checked={pomboAs.destino==='Impressora'} onChange={()=>setPomboAs({...pomboAs,destino:'Impressora'})} /> Impressora</label><label><input type="radio" checked={pomboAs.destino==='Ficheiro Excel'} onChange={()=>setPomboAs({...pomboAs,destino:'Ficheiro Excel'})} /> Ficheiro Excel</label><input placeholder="C:\\SGSP\\EXP\\" style={{...s.field,flex:1}} />
                </div>
                <div style={{fontSize:'10px',color:'#800000',marginTop:'4px',textAlign:'center'}}>NOTA: Pombo Ás considera apenas pombos com ≥ {pomboAs.minimo} classificações em {pomboAs.categoria}</div>
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'12px'}}><button style={s.btn} onClick={()=>open('pomboAsResult')}>▶️ Confirmar</button><button style={s.btn} onClick={()=>close('pomboAs')}>📁 Sair</button></div>
            </div>
          </div>
        )}
        {wins.includes('pomboAsResult') && (
          <div style={{...s.win,width:'900px'}}>
            <div style={s.winTitle}><span>CLUBE COLUMBÓFILO LIMEIRENSE — Pombo Ás — {pomboAs.categoria}</span><button onClick={()=>close('pomboAsResult')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,backgroundColor:'#fff',fontFamily:'Arial',fontSize:'11px'}}>
              <div style={{textAlign:'center',fontWeight:'bold',color:'#008080',fontSize:'13px'}}>CLUBE COLUMBÓFILO LIMEIRENSE</div>
              <div style={{textAlign:'center',fontWeight:'bold'}}>Análise Classificações — Pombo Ás — {pomboAs.categoria} — Critério: {pomboAs.criterio}</div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',marginTop:'4px',border:'1px solid #000',padding:'4px',backgroundColor:'#e8e8e8'}}>
                <span><b>Ano:</b> {pomboAs.ano} &nbsp; <b>Concursos:</b> {pomboAs.de} a {pomboAs.ate}</span><span><b>Tipo:</b> {pomboAs.tipoProva} &nbsp; <b>Mínimo:</b> {pomboAs.minimo} provas</span><span><b>Data:</b> {concurso.data}</span>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse',marginTop:'6px',fontSize:'10px'}}>
                <thead><tr style={{backgroundColor:'#000080',color:'#fff'}}><th style={{border:'1px solid #000',padding:'3px'}}>Pos</th><th style={{border:'1px solid #000',padding:'3px'}}>Anilha</th><th style={{border:'1px solid #000',padding:'3px'}}>Sexo</th><th style={{border:'1px solid #000',padding:'3px'}}>Concorrente</th><th style={{border:'1px solid #000',padding:'3px'}}>Provas</th><th style={{border:'1px solid #000',padding:'3px'}}>{pomboAs.criterio==='Coeficiente'?'Coef. Total':'Pontos'}</th><th style={{border:'1px solid #000',padding:'3px'}}>Média</th><th style={{border:'1px solid #000',padding:'3px'}}>Clas</th></tr></thead>
                <tbody>
                  <tr style={{backgroundColor:'#ffffc0'}}><td style={{border:'1px solid #000',textAlign:'center',fontWeight:'bold'}}>1</td><td style={{border:'1px solid #000',fontWeight:'bold'}}>0084701/20</td><td style={{border:'1px solid #000',textAlign:'center'}}>M</td><td style={{border:'1px solid #000'}}>33/1508 BORDIN & MARQUINHO</td><td style={{border:'1px solid #000',textAlign:'center'}}>6</td><td style={{border:'1px solid #000',textAlign:'right',fontWeight:'bold'}}>{pomboAs.criterio==='Coeficiente'?'12,45':'553'}</td><td style={{border:'1px solid #000',textAlign:'center'}}>1185,46</td><td style={{border:'1px solid #000',textAlign:'center'}}>2</td></tr>
                  <tr><td style={{border:'1px solid #000',textAlign:'center'}}>2</td><td style={{border:'1px solid #000'}}>233027/23</td><td style={{border:'1px solid #000',textAlign:'center'}}>F</td><td style={{border:'1px solid #000'}}>33/283 GLAUCION CLAITO SILVA</td><td style={{border:'1px solid #000',textAlign:'center'}}>5</td><td style={{border:'1px solid #000',textAlign:'right'}}>{pomboAs.criterio==='Coeficiente'?'18,32':'469'}</td><td style={{border:'1px solid #000',textAlign:'center'}}>1120,12</td><td style={{border:'1px solid #000',textAlign:'center'}}>1</td></tr>
                  <tr><td style={{border:'1px solid #000',textAlign:'center'}}>3</td><td style={{border:'1px solid #000'}}>2320071/23</td><td style={{border:'1px solid #000',textAlign:'center'}}>M</td><td style={{border:'1px solid #000'}}>33/81 VILMAR ALMEIDA PORTA DO SOL</td><td style={{border:'1px solid #000',textAlign:'center'}}>4</td><td style={{border:'1px solid #000',textAlign:'right'}}>{pomboAs.criterio==='Coeficiente'?'21,08':'373'}</td><td style={{border:'1px solid #000',textAlign:'center'}}>988,27</td><td style={{border:'1px solid #000',textAlign:'center'}}>3</td></tr>
                  <tr><td style={{border:'1px solid #000',textAlign:'center'}}>4</td><td style={{border:'1px solid #000'}}>0084751/20</td><td style={{border:'1px solid #000',textAlign:'center'}}>M</td><td style={{border:'1px solid #000'}}>33/1508 BORDIN & MARQUINHO</td><td style={{border:'1px solid #000',textAlign:'center'}}>4</td><td style={{border:'1px solid #000',textAlign:'right'}}>{pomboAs.criterio==='Coeficiente'?'24,51':'369'}</td><td style={{border:'1px solid #000',textAlign:'center'}}>1185,40</td><td style={{border:'1px solid #000',textAlign:'center'}}>4</td></tr>
                  <tr><td style={{border:'1px solid #000',textAlign:'center'}}>5</td><td style={{border:'1px solid #000'}}>1134642/21</td><td style={{border:'1px solid #000',textAlign:'center'}}>F</td><td style={{border:'1px solid #000'}}>33/91 EDSON ROBERTO DA SILVA</td><td style={{border:'1px solid #000',textAlign:'center'}}>3</td><td style={{border:'1px solid #000',textAlign:'right'}}>{pomboAs.criterio==='Coeficiente'?'28,14':'243'}</td><td style={{border:'1px solid #000',textAlign:'center'}}>1024,33</td><td style={{border:'1px solid #000',textAlign:'center'}}>7</td></tr>
                </tbody>
              </table>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:'6px',fontSize:'10px',backgroundColor:'#c0c0c0',padding:'3px 6px',border:'1px solid #808080'}}><span>Total de pombos apurados: 47 — Critério {pomboAs.criterio} — {pomboAs.categoria}</span><span><button style={s.btn} onClick={()=>{
                const csv=`Pombo As - ${pomboAs.categoria} - Ano ${pomboAs.ano} - ${pomboAs.criterio}
Pos;Anilha;Concorrente;Provas;${pomboAs.criterio}
1;0084701/20;33/1508 BORDIN;6;${pomboAs.criterio==='Coeficiente'?'12,45':'553'}
`;
                const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`POMBO_AS_${pomboAs.categoria}_${pomboAs.ano}.csv`; a.click(); URL.revokeObjectURL(url);
              }}>⬇️ Exportar Excel</button> <button style={s.btn} onClick={()=>close('pomboAsResult')}>Sair</button></span></div>
            </div>
          </div>
        )}
                {/* PALMARES DO POMBO / COEFICIENTES */}
        {wins.includes('palmares') && (
          <div style={s.win}>
            <div style={s.winTitle}><span>Palmarés do Pombo / Coeficientes</span><button onClick={()=>close('palmares')} style={s.tbtn}>X</button></div>
            <div style={s.body}>
              <div style={{border:'2px groove #fff',padding:'6px',marginBottom:'6px'}}>
                <div style={{fontWeight:'bold',textAlign:'center',marginBottom:'8px'}}>Selecção do Pombo</div>
                <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                  <label>Anilha :</label>
                  <input value={palmares.anilha} onChange={e=>setPalmares({...palmares,anilha:maskAnilha(e.target.value)})} placeholder="0000000/00" style={{...s.field,width:'110px',fontWeight:'bold',backgroundColor:'#e0f0ff'}} maxLength={10} />
                  <button style={s.tbtn} onClick={()=>setLupaPalmares(true)}>🔍</button>
                  <span style={{flex:1,backgroundColor:'#e8e8e8',border:'2px inset #fff',padding:'2px 6px',fontWeight:'bold',color:'#000080'}}>{socios.find(sc=>sc.nome.includes('BORDIN'))?.nome || 'BORDIN & MARQUINHO'} — {palmares.anilha}</span>
                </div>
                <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                  <label>Ano :</label><input value={palmares.ano} onChange={e=>setPalmares({...palmares,ano:e.target.value})} style={{...s.field,width:'60px',textAlign:'center',backgroundColor:'#b0d0ff',fontWeight:'bold'}} />
                  <label>Categoria :</label>
                  <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>{['VELOCIDADE','MEIO-FUNDO','FUNDO','GRANDE FUNDO','FILHOTES','GERAL'].map(cat=> <label key={cat}><input type="radio" checked={palmares.categoria===cat} onChange={()=>setPalmares({...palmares,categoria:cat})} /> {cat}</label>)}</div>
                </div>
                <div style={{display:'flex',gap:'10px',marginTop:'6px',alignItems:'center'}}>
                  <label>Tipo de Provas :</label><label><input type="radio" checked={palmares.tipoProva==='Oficiais'} onChange={()=>setPalmares({...palmares,tipoProva:'Oficiais'})} /> Oficiais</label><label><input type="radio" checked={palmares.tipoProva==='Não Oficiais'} onChange={()=>setPalmares({...palmares,tipoProva:'Não Oficiais'})} /> Não Oficiais</label><label><input type="radio" checked={palmares.tipoProva==='Todas'} onChange={()=>setPalmares({...palmares,tipoProva:'Todas'})} /> Todas</label>
                  <label style={{marginLeft:'auto'}}>Destino :</label><label><input type="radio" defaultChecked /> Impressora</label><label><input type="radio" /> Excel</label>
                </div>
              </div>
              <div style={{border:'1px solid #808080',padding:'6px',backgroundColor:'#ffffe1',fontSize:'10px',marginBottom:'8px'}}>
                <b>Nota:</b> Palmarés apresenta todas as participações do pombo seleccionado na época {palmares.ano} com cálculo automático de coeficientes (Coef = Posição / Nº Pombos × 1000). Coeficiente menor = melhor.
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'12px'}}><button style={s.btn} onClick={()=>open('palmaresResult')}>▶️ Confirmar</button><button style={s.btn} onClick={()=>close('palmares')}>📁 Sair</button></div>
            </div>
          </div>
        )}
        {wins.includes('palmaresResult') && (
          <div style={{...s.win,width:'920px'}}>
            <div style={s.winTitle}><span>CLUBE COLUMBÓFILO LIMEIRENSE — Palmarés do Pombo {palmares.anilha}</span><button onClick={()=>close('palmaresResult')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,backgroundColor:'#fff',fontFamily:'Arial',fontSize:'11px'}}>
              <div style={{textAlign:'center',fontWeight:'bold',color:'#008080',fontSize:'13px'}}>CLUBE COLUMBÓFILO LIMEIRENSE</div>
              <div style={{textAlign:'center',fontWeight:'bold'}}>Palmarés do Pombo — Coeficientes</div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'11px',marginTop:'4px',border:'1px solid #000',padding:'4px',backgroundColor:'#c0c0c0'}}>
                <span><b>Anilha:</b> {palmares.anilha} — <b>Pombo:</b> Macho — <b>Proprietário:</b> 33/1508 BORDIN & MARQUINHO</span><span><b>Categoria:</b> {palmares.categoria}</span>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse',marginTop:'6px',fontSize:'10px'}}>
                <thead><tr style={{backgroundColor:'#000080',color:'#fff'}}><th style={{border:'1px solid #000',padding:'3px'}}>Data</th><th style={{border:'1px solid #000',padding:'3px'}}>Concurso</th><th style={{border:'1px solid #000',padding:'3px'}}>Tipo</th><th style={{border:'1px solid #000',padding:'3px'}}>Dist.</th><th style={{border:'1px solid #000',padding:'3px'}}>Clas.</th><th style={{border:'1px solid #000',padding:'3px'}}>Enviados</th><th style={{border:'1px solid #000',padding:'3px'}}>Média</th><th style={{border:'1px solid #000',padding:'3px'}}>Pontos</th><th style={{border:'1px solid #000',padding:'3px',backgroundColor:'#ffff00',color:'#000'}}>Coef.</th></tr></thead>
                <tbody>
                  <tr><td style={{border:'1px solid #000',textAlign:'center'}}>15/03/2025</td><td style={{border:'1px solid #000'}}>01 - Itapetininga-SP</td><td style={{border:'1px solid #000',textAlign:'center'}}>VELOC</td><td style={{border:'1px solid #000',textAlign:'right'}}>184.231</td><td style={{border:'1px solid #000',textAlign:'center',fontWeight:'bold'}}>12º</td><td style={{border:'1px solid #000',textAlign:'center'}}>420</td><td style={{border:'1px solid #000',textAlign:'center'}}>1.245,32</td><td style={{border:'1px solid #000',textAlign:'center'}}>88</td><td style={{border:'1px solid #000',textAlign:'center',backgroundColor:'#e8f0ff',fontWeight:'bold'}}>28,57</td></tr>
                  <tr style={{backgroundColor:'#f0f0f0'}}><td style={{border:'1px solid #000',textAlign:'center'}}>29/03/2025</td><td style={{border:'1px solid #000'}}>03 - Itapeva-SP</td><td style={{border:'1px solid #000',textAlign:'center'}}>VELOC</td><td style={{border:'1px solid #000',textAlign:'right'}}>252.108</td><td style={{border:'1px solid #000',textAlign:'center',fontWeight:'bold'}}>4º</td><td style={{border:'1px solid #000',textAlign:'center'}}>380</td><td style={{border:'1px solid #000',textAlign:'center'}}>1.198,45</td><td style={{border:'1px solid #000',textAlign:'center'}}>96</td><td style={{border:'1px solid #000',textAlign:'center',backgroundColor:'#e8f0ff',fontWeight:'bold'}}>10,52</td></tr>
                  <tr><td style={{border:'1px solid #000',textAlign:'center'}}>12/04/2025</td><td style={{border:'1px solid #000'}}>05 - Itararé-PR</td><td style={{border:'1px solid #000',textAlign:'center'}}>MEIO</td><td style={{border:'1px solid #000',textAlign:'right'}}>310.450</td><td style={{border:'1px solid #000',textAlign:'center',fontWeight:'bold'}}>2º</td><td style={{border:'1px solid #000',textAlign:'center'}}>350</td><td style={{border:'1px solid #000',textAlign:'center'}}>1.185,46</td><td style={{border:'1px solid #000',textAlign:'center'}}>100</td><td style={{border:'1px solid #000',textAlign:'center',backgroundColor:'#ffffc0',fontWeight:'bold'}}>5,71</td></tr>
                  <tr style={{backgroundColor:'#f0f0f0'}}><td style={{border:'1px solid #000',textAlign:'center'}}>20/09/2025</td><td style={{border:'1px solid #000'}}>16 - Brasilia-DF</td><td style={{border:'1px solid #000',textAlign:'center'}}>FUNDO</td><td style={{border:'1px solid #000',textAlign:'right'}}>764.823</td><td style={{border:'1px solid #000',textAlign:'center',fontWeight:'bold'}}>1º</td><td style={{border:'1px solid #000',textAlign:'center'}}>300</td><td style={{border:'1px solid #000',textAlign:'center'}}>1.185,40</td><td style={{border:'1px solid #000',textAlign:'center'}}>100</td><td style={{border:'1px solid #000',textAlign:'center',backgroundColor:'#c0ffc0',fontWeight:'bold'}}>3,33</td></tr>
                  <tr style={{backgroundColor:'#000080',color:'#fff',fontWeight:'bold'}}><td colSpan={5} style={{border:'1px solid #000',textAlign:'right',padding:'3px'}}>TOTAIS — 4 provas classificadas</td><td style={{border:'1px solid #000',textAlign:'center'}}>—</td><td style={{border:'1px solid #000',textAlign:'center'}}>1.203,65</td><td style={{border:'1px solid #000',textAlign:'center'}}>384</td><td style={{border:'1px solid #000',textAlign:'center',backgroundColor:'#ffff00',color:'#000'}}>48,13</td></tr>
                </tbody>
              </table>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginTop:'6px'}}>
                <div style={{border:'1px solid #000',padding:'4px',backgroundColor:'#ffffe1',fontSize:'10px'}}><b>Coeficiente Geral:</b> 48,13 — <b>Média Coef.:</b> 12,03 — <b>Melhor Coef.:</b> 3,33 (Brasilia-DF)<br/><b>Coeficiente VELOCIDADE:</b> 39,09 &nbsp; <b>MEIO-FUNDO:</b> 5,71 &nbsp; <b>FUNDO:</b> 3,33</div>
                <div style={{border:'1px solid #000',padding:'4px',backgroundColor:'#e8f0ff',fontSize:'10px',textAlign:'center'}}><b>Pontuação Total:</b> 384 pts — <b>Class. Pombo Ás GERAL:</b> 2º lugar — <b>Prémios:</b> 2× 1º + 1× 2º</div>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:'8px',fontSize:'11px',backgroundColor:'#c0c0c0',padding:'4px 6px',border:'1px solid #808080',alignItems:'center'}}><span>Palmarés completo — {palmares.anilha}</span><span><button style={s.btn} onClick={()=>{
                const csv=`Palmares ${palmares.anilha} Ano ${palmares.ano}
Data;Concurso;Tipo;Clas;Coef
15/03/2025;01 Itapetininga;VELOC;12;28,57
`;
                const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`PALMARES_${palmares.anilha.replace('/','_')}_${palmares.ano}.csv`; a.click(); URL.revokeObjectURL(url);
              }}>⬇️ Exportar Excel</button> <button style={{...s.btn,marginLeft:'6px'}} onClick={()=>close('palmaresResult')}>Sair</button></span></div>
              {/* lupa palmares */}
              {lupaPalmares && <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}} onClick={()=>setLupaPalmares(false)}><div style={{backgroundColor:'#c0c0c0',border:'2px outset #fff',width:'460px',padding:'8px'}} onClick={e=>e.stopPropagation()}><div style={{...s.winTitle,margin:'-8px -8px 8px -8px'}}><span>🔍 Pesquisar Pombo</span><button style={s.tbtn} onClick={()=>setLupaPalmares(false)}>X</button></div>{['0084701/20 - BORDIN & MARQUINHO','0084751/20 - BORDIN & MARQUINHO','233027/23 - GLAUCION CLAITO SILVA','2320071/23 - VILMAR ALMEIDA','1134642/21 - EDSON ROBERTO'].map(an=><div key={an} onClick={()=>{setPalmares({...palmares,anilha:an.split(' ')[0]}); setLupaPalmares(false);}} style={{padding:'6px',borderBottom:'1px solid #808080',cursor:'pointer',backgroundColor:'#fff'}}>{an}</div>)}<div style={{textAlign:'right',marginTop:'8px'}}><button style={s.btn} onClick={()=>setLupaPalmares(false)}>Sair</button></div></div></div>}
            </div>
          </div>
        )}
                {/* CLASSIFICAÇÃO DE CONCORRENTES (TOTAIS) - FIEL AO PRINT */}
        {wins.includes('concTotaisWin') && (
          <div style={{...s.win,width:'560px'}}>
            <div style={s.winTitle}><span>Classificação de Concorrentes (Totais)</span><button onClick={()=>close('concTotaisWin')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'6px'}}>
              <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'4px'}}>
                <label style={{fontWeight:'bold',width:'50px'}}>Provas :</label>
                <label style={{border:'1px solid #808080',padding:'2px 6px',backgroundColor:'#d4d0c8'}}><input type="radio" checked={concTotais.provas==='Oficiais'} onChange={()=>setConcTotais({...concTotais,provas:'Oficiais'})} /> Oficiais</label>
                <label style={{border:'1px solid #808080',padding:'2px 6px'}}><input type="radio" checked={concTotais.provas==='Não Oficiais'} onChange={()=>setConcTotais({...concTotais,provas:'Não Oficiais'})} /> Não Oficiais</label>
              </div>
              <div style={{border:'1px solid #808080',padding:'4px',marginBottom:'4px',backgroundColor:'#d4d0c8'}}>
                <label style={{fontWeight:'bold',fontSize:'10px'}}>Tipo de prova :</label>
                <div style={{display:'flex',gap:'4px',marginTop:'2px',flexWrap:'wrap'}}>
                  {['Velocidade','Meio Fundo','Fundo','Grande Fundo','Geral'].map(tp=> (
                    <label key={tp} style={{border: concTotais.tipoProva===tp ? '1px inset #fff' : '1px solid #a0a0a0', padding:'2px 4px', backgroundColor: concTotais.tipoProva===tp ? '#ffffc0' : '#fff', fontWeight: concTotais.tipoProva===tp ? 'bold':'normal'}}><input type="radio" checked={concTotais.tipoProva===tp} onChange={()=>setConcTotais({...concTotais,tipoProva:tp, titulo:`Classificação de Concorrentes - ${tp}`})} /> {tp}</label>
                  ))}
                </div>
              </div>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}>
                <label style={{fontWeight:'bold',fontSize:'10px'}}>Especialidades :</label>
                <label style={{backgroundColor:'#fff',border:'2px inset #fff',padding:'1px 4px'}}><input type="checkbox" checked={concTotais.espVel} onChange={e=>setConcTotais({...concTotais,espVel:e.target.checked})} /> Velocidade</label>
                <label style={{backgroundColor:'#fff',border:'2px inset #fff',padding:'1px 4px'}}><input type="checkbox" checked={concTotais.espMeio} onChange={e=>setConcTotais({...concTotais,espMeio:e.target.checked})} /> Meio Fundo</label>
                <label style={{backgroundColor:'#fff',border:'2px inset #fff',padding:'1px 4px'}}><input type="checkbox" checked={concTotais.espFundo} onChange={e=>setConcTotais({...concTotais,espFundo:e.target.checked})} /> Fundo</label>
                <label style={{backgroundColor:'#fff',border:'2px inset #fff',padding:'1px 4px'}}><input type="checkbox" checked={concTotais.espGrande} onChange={e=>setConcTotais({...concTotais,espGrande:e.target.checked})} /> Grande Fundo</label>
              </div>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}>
                <label style={{width:'80px',fontSize:'10px'}}>Titulo de Mapa :</label>
                <input value={concTotais.titulo} onChange={e=>setConcTotais({...concTotais,titulo:e.target.value})} style={{...s.field,flex:1,backgroundColor:'#fff'}} />
              </div>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                <label style={{width:'80px',fontSize:'10px'}}>Do grupo :</label>
                <input value={concTotais.grupo} onChange={e=>setConcTotais({...concTotais,grupo:e.target.value})} style={{...s.field,width:'40px'}} />
                <button style={{...s.tbtn,padding:'2px 6px'}} title="Pesquisar grupo" onClick={()=>{setLupaTarget('concGrupo'); setLupaGrupo(true);}}>🏢</button>
                <input style={{...s.field,flex:1,backgroundColor:'#e8e8e8'}} readOnly placeholder="(todos os grupos)" />
              </div>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}>
                <label style={{width:'80px',fontSize:'10px'}}>Os melhores :</label>
                <input value={concTotais.melhores} onChange={e=>setConcTotais({...concTotais,melhores:e.target.value})} style={{...s.field,width:'70px',textAlign:'center',fontWeight:'bold'}} />
                <label style={{marginLeft:'8px',fontSize:'10px'}}>Concorrentes com zero ponto ?</label>
                <label><input type="radio" checked={concTotais.zeroPonto==='Não'} onChange={()=>setConcTotais({...concTotais,zeroPonto:'Não'})} /> Não</label>
                <label><input type="radio" checked={concTotais.zeroPonto==='Sim'} onChange={()=>setConcTotais({...concTotais,zeroPonto:'Sim'})} /> Sim</label>
              </div>
              <div style={{display:'flex',gap:'12px',alignItems:'center',marginBottom:'4px',flexWrap:'wrap'}}>
                <label style={{fontSize:'10px'}}>Emitir critério de desempate ?</label>
                <label><input type="radio" checked={concTotais.desempate==='Não'} onChange={()=>setConcTotais({...concTotais,desempate:'Não'})} /> Não</label>
                <label><input type="radio" checked={concTotais.desempate==='Sim'} onChange={()=>setConcTotais({...concTotais,desempate:'Sim'})} /> Sim</label>
              </div>
              <div style={{display:'flex',gap:'12px',alignItems:'center',marginBottom:'4px',flexWrap:'wrap'}}>
                <label style={{fontSize:'10px'}}>Com coeficientes ?</label>
                <label><input type="radio" checked={concTotais.coeficientes==='Não'} onChange={()=>setConcTotais({...concTotais,coeficientes:'Não'})} /> Não</label>
                <label><input type="radio" checked={concTotais.coeficientes==='Sim'} onChange={()=>setConcTotais({...concTotais,coeficientes:'Sim'})} /> Sim</label>
              </div>
              <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'6px',flexWrap:'wrap'}}>
                <label style={{fontSize:'10px'}}>Retirar a pior prova de campeonato ?</label>
                <label><input type="radio" checked={concTotais.retirar==='Não'} onChange={()=>setConcTotais({...concTotais,retirar:'Não'})} /> Não</label>
                <label><input type="radio" checked={concTotais.retirar==='Sim'} onChange={()=>setConcTotais({...concTotais,retirar:'Sim'})} /> Sim</label>
                <label style={{marginLeft:'8px',fontSize:'10px'}}>Realçar os</label><input value={concTotais.realcar} onChange={e=>setConcTotais({...concTotais,realcar:e.target.value})} style={{...s.field,width:'30px',textAlign:'center'}} /><label style={{fontSize:'10px'}}>melhores</label>
              </div>
              <div style={{border:'2px groove #fff',padding:'6px',backgroundColor:'#d4d0c8',marginBottom:'4px'}}>
                <div style={{fontWeight:'bold',textAlign:'center',fontSize:'10px',marginBottom:'4px'}}>Parâmetros</div>
                <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'4px',flexWrap:'wrap'}}>
                  <label style={{fontSize:'10px'}}>Destino :</label>
                  <label><input type="radio" checked={concTotais.destino==='Impressora'} onChange={()=>setConcTotais({...concTotais,destino:'Impressora'})} /> Impressora</label>
                  <label><input type="radio" checked={concTotais.destino==='Ficheiro Excel'} onChange={()=>setConcTotais({...concTotais,destino:'Ficheiro Excel'})} /> Ficheiro Excel</label>
                  <input placeholder="C:\\SGSP\\EXP\\" style={{...s.field,flex:1}} />
                </div>
                <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                  <label style={{fontSize:'10px'}}>Da página</label><input value={concTotais.daPag} onChange={e=>setConcTotais({...concTotais,daPag:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                  <label style={{fontSize:'10px'}}>à página</label><input value={concTotais.atePag} onChange={e=>setConcTotais({...concTotais,atePag:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                  <label style={{fontSize:'10px'}}>Cópias :</label><input value={concTotais.copias} onChange={e=>setConcTotais({...concTotais,copias:e.target.value})} style={{...s.field,width:'30px',textAlign:'center'}} />
                </div>
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'12px'}}>
                <button style={{...s.btn,minWidth:'80px'}} onClick={()=>open('concTotaisResult')}>Confirmar</button>
                <button style={{...s.btn,minWidth:'80px'}} onClick={()=>close('concTotaisWin')}>Sair</button>
              </div>
            </div>
          </div>
        )}
        
        
        {wins.includes('concTotaisResult') && (()=>{
          const todas = {
            'Velocidade': [
              {lugar:1, lic:'33/ 81', nome:'VILMAR ALMEIDA PORTA DO SOL', pts:1421},
              {lugar:2, lic:'33/283', nome:'GLAUCION CLAITO SILVA', pts:1349},
              {lugar:3, lic:'33/1508', nome:'BORDIN & MARQUINHO', pts:1306},
              {lugar:4, lic:'33/ 91', nome:'EDSON ROBERTO DA SILVA', pts:1305},
              {lugar:5, lic:'33/1515', nome:'CARLOS ALBERTO DA SILVA', pts:1263},
              {lugar:6, lic:'33/1503', nome:'PASCHOAL LOVADINI', pts:1018},
              {lugar:7, lic:'33/1512', nome:'FRANCISCO TOLEDO RODOVALHO', pts:928},
              {lugar:8, lic:'33/1505', nome:'CARLOS ROBERTO DIAS', pts:798},
              {lugar:9, lic:'33/1517', nome:'VENERANDO SOARES DA SILVA', pts:777},
            ],
            'Meio Fundo': [
              {lugar:1, lic:'33/1508', nome:'BORDIN & MARQUINHO', pts:1388},
              {lugar:2, lic:'33/ 81', nome:'VILMAR ALMEIDA PORTA DO SOL', pts:1320},
              {lugar:3, lic:'33/283', nome:'GLAUCION CLAITO SILVA', pts:1285},
              {lugar:4, lic:'33/ 91', nome:'EDSON ROBERTO DA SILVA', pts:1240},
              {lugar:5, lic:'33/1515', nome:'CARLOS ALBERTO DA SILVA', pts:1199},
            ],
            'Fundo': [
              {lugar:1, lic:'33/1508', nome:'BORDIN & MARQUINHO', pts:1180},
              {lugar:2, lic:'33/ 81', nome:'VILMAR ALMEIDA PORTA DO SOL', pts:1155},
            ],
            'Grande Fundo': [
              {lugar:1, lic:'33/1508', nome:'BORDIN & MARQUINHO', pts:980},
            ],
            'Total': [
              {lugar:1, lic:'33/1508', nome:'BORDIN & MARQUINHO', pts:4469},
              {lugar:2, lic:'33/ 81', nome:'VILMAR ALMEIDA PORTA DO SOL', pts:4456},
              {lugar:3, lic:'33/ 91', nome:'EDSON ROBERTO DA SILVA', pts:4151},
              {lugar:4, lic:'33/1515', nome:'CARLOS ALBERTO DA SILVA', pts:4064},
              {lugar:5, lic:'33/283', nome:'GLAUCION CLAITO SILVA', pts:2968},
            ],
            'Geral': [
              {lugar:1, lic:'33/1508', nome:'BORDIN & MARQUINHO', pts:4469},
              {lugar:2, lic:'33/ 81', nome:'VILMAR ALMEIDA PORTA DO SOL', pts:4456},
              {lugar:3, lic:'33/ 91', nome:'EDSON ROBERTO DA SILVA', pts:4151},
              {lugar:4, lic:'33/1515', nome:'CARLOS ALBERTO DA SILVA', pts:4064},
              {lugar:5, lic:'33/283', nome:'GLAUCION CLAITO SILVA', pts:2968},
              {lugar:6, lic:'33/1512', nome:'FRANCISCO TOLEDO RODOVALHO', pts:2561},
              {lugar:7, lic:'33/1503', nome:'PASCHOAL LOVADINI', pts:2138},
              {lugar:8, lic:'33/1517', nome:'VENERANDO SOARES DA SILVA', pts:2004},
              {lugar:9, lic:'33/1505', nome:'CARLOS ROBERTO DIAS', pts:1684},
            ],
          };
          var dados = todas[concTotais.tipoProva] || todas['Geral'];
          var ateLabel = concTotais.tipoProva==='Velocidade' ? (concurso.ano+'/10 - Uberaba-MG') : (concurso.ano+'/16 - Brasilia-DF');
          return (
          <div style={{...s.win,width:'780px'}}>
            <div style={s.winTitle}><span>Print Preview - Classificacao - {concTotais.tipoProva}</span><button onClick={()=>close('concTotaisResult')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,backgroundColor:'#fff',fontFamily:'Arial',fontSize:'11px'}}>
              <div style={{textAlign:'center',fontWeight:'bold',color:'#008080',fontSize:'14px',fontStyle:'italic'}}>CLUBE COLUMBOMFILO LIMEIRENSE</div>
              <div style={{textAlign:'center',fontWeight:'bold',fontSize:'12px',marginBottom:'6px',color:'#000080'}}>Classificacao de Concorrentes - {concTotais.tipoProva}</div>
              <div style={{border:'1px solid #000',padding:'6px',backgroundColor:'#fff'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px'}}>
                  <thead><tr style={{backgroundColor:'#c0c0c0'}}><th style={{border:'1px solid #000',padding:'3px',textAlign:'center',width:'60px'}}>Lugar</th><th style={{border:'1px solid #000',padding:'3px'}}>Concorrente</th><th style={{border:'1px solid #000',padding:'3px',textAlign:'center',width:'100px'}}>Pontos</th></tr></thead>
                  <tbody>{dados.map(r=> (<tr key={r.lugar}><td style={{border:'1px solid #c0c0c0',padding:'3px 6px',textAlign:'center'}}>{r.lugar}</td><td style={{border:'1px solid #c0c0c0',padding:'3px 6px'}}>{r.lic} {r.nome}</td><td style={{border:'1px solid #c0c0c0',padding:'3px 6px',textAlign:'right',fontWeight:'bold'}}>{r.pts}</td></tr>))}</tbody>
                </table>
                <div style={{textAlign:'center',fontSize:'11px',marginTop:'12px',fontStyle:'italic'}}>Ate a prova {ateLabel}</div>
              </div>
            </div>
          </div>
          );
        })()}
                {wins.includes('pombosTotaisWin') && (
          <div style={{...s.win,width:'560px'}}>
            <div style={s.winTitle}><span>Classificação de Pombos (Totais)</span><button onClick={()=>close('pombosTotaisWin')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'6px'}}>
              <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'4px'}}>
                <label style={{fontWeight:'bold',width:'50px'}}>Provas :</label>
                <label style={{border:'1px solid #808080',padding:'2px 6px',backgroundColor: pombosTotais.provas==='Oficiais' ? '#d4d0c8':'#fff'}}><input type="radio" checked={pombosTotais.provas==='Oficiais'} onChange={()=>setPombosTotais({...pombosTotais,provas:'Oficiais'})} /> Oficiais</label>
                <label style={{border:'1px solid #808080',padding:'2px 6px'}}><input type="radio" checked={pombosTotais.provas==='Não Oficiais'} onChange={()=>setPombosTotais({...pombosTotais,provas:'Não Oficiais'})} /> Não Oficiais</label>
              </div>
              <div style={{border:'1px solid #808080',padding:'4px',marginBottom:'4px',backgroundColor:'#d4d0c8'}}>
                <label style={{fontWeight:'bold',fontSize:'10px'}}>Tipo de prova :</label>
                <div style={{display:'flex',gap:'4px',marginTop:'2px',flexWrap:'wrap'}}>
                  {['Velocidade','Meio Fundo','Fundo','Grande Fundo','Geral'].map(tp=> (
                    <label key={tp} style={{border: pombosTotais.tipoProva===tp ? '1px inset #fff' : '1px solid #a0a0a0', padding:'2px 4px', backgroundColor: pombosTotais.tipoProva===tp ? '#ffffc0' : '#fff'}}><input type="radio" checked={pombosTotais.tipoProva===tp} onChange={()=>setPombosTotais({...pombosTotais,tipoProva:tp})} /> {tp}</label>
                  ))}
                </div>
              </div>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                <label style={{width:'80px',fontSize:'10px'}}>Do grupo :</label>
                <input value={pombosTotais.grupo} onChange={e=>setPombosTotais({...pombosTotais,grupo:e.target.value})} style={{...s.field,width:'40px'}} />
                <button style={{...s.tbtn,padding:'2px 6px'}} title="Pesquisar grupo" onClick={()=>{setLupaTarget('pombosGrupo'); setLupaGrupo(true);}}>🏢</button>
                <input style={{...s.field,flex:1,backgroundColor:'#e8e8e8'}} readOnly placeholder="(todos os grupos)" />
              </div>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}>
                <label style={{width:'80px',fontSize:'10px'}}>Os melhores :</label>
                <input value={pombosTotais.melhores} onChange={e=>setPombosTotais({...pombosTotais,melhores:e.target.value})} style={{...s.field,width:'70px',textAlign:'center',fontWeight:'bold'}} />
                <label style={{marginLeft:'12px',fontSize:'10px'}}>Realçar os</label><input value={pombosTotais.realcar} onChange={e=>setPombosTotais({...pombosTotais,realcar:e.target.value})} style={{...s.field,width:'30px',textAlign:'center'}} /><label style={{fontSize:'10px'}}>melhores classificações.</label>
              </div>
              <div style={{display:'flex',gap:'12px',alignItems:'center',marginBottom:'4px'}}>
                <label style={{fontSize:'10px'}}>Emitir critério de desempate ?</label>
                <label><input type="radio" checked={pombosTotais.desempate==='Não'} onChange={()=>setPombosTotais({...pombosTotais,desempate:'Não'})} /> Não</label>
                <label><input type="radio" checked={pombosTotais.desempate==='Sim'} onChange={()=>setPombosTotais({...pombosTotais,desempate:'Sim'})} /> Sim</label>
              </div>
              <div style={{border:'2px groove #fff',padding:'6px',backgroundColor:'#d4d0c8',marginBottom:'4px'}}>
                <div style={{fontWeight:'bold',textAlign:'center',fontSize:'10px',marginBottom:'4px'}}>Parâmetros</div>
                <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'4px',flexWrap:'wrap'}}>
                  <label style={{fontSize:'10px'}}>Destino :</label>
                  <label><input type="radio" checked={pombosTotais.destino==='Impressora'} onChange={()=>setPombosTotais({...pombosTotais,destino:'Impressora'})} /> Impressora</label>
                  <label><input type="radio" checked={pombosTotais.destino==='Ficheiro Excel'} onChange={()=>setPombosTotais({...pombosTotais,destino:'Ficheiro Excel'})} /> Ficheiro Excel</label>
                  <input placeholder="C:\\SGSP\\EXP\\" style={{...s.field,flex:1}} />
                </div>
                <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                  <label style={{fontSize:'10px'}}>Da página</label><input value={pombosTotais.daPag} onChange={e=>setPombosTotais({...pombosTotais,daPag:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                  <label style={{fontSize:'10px'}}>à página</label><input value={pombosTotais.atePag} onChange={e=>setPombosTotais({...pombosTotais,atePag:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                  <label style={{fontSize:'10px'}}>Cópias :</label><input value={pombosTotais.copias} onChange={e=>setPombosTotais({...pombosTotais,copias:e.target.value})} style={{...s.field,width:'30px',textAlign:'center'}} />
                </div>
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'12px'}}>
                <button style={{...s.btn,minWidth:'80px'}} onClick={()=>open('pombosTotaisResult')}>Confirmar</button>
                <button style={{...s.btn,minWidth:'80px'}} onClick={()=>close('pombosTotaisWin')}>Sair</button>
              </div>
            </div>
          </div>
        )}
        {wins.includes('pombosTotaisResult') && (
          <div style={{...s.win,width:'820px'}}>
            <div style={s.winTitle}><span>CLUBE COLUMBOMFILO LIMEIRENSE — Classificação Geral de Pombos - {pombosTotais.tipoProva}</span><button onClick={()=>close('pombosTotaisResult')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,backgroundColor:'#fff',fontFamily:'Arial',fontSize:'11px'}}>
              <div style={{textAlign:'center',fontWeight:'bold',color:'#008080',fontSize:'14px',fontStyle:'italic'}}>CLUBE COLUMBOMFILO LIMEIRENSE</div>
              <div style={{textAlign:'center',fontWeight:'bold',fontSize:'12px',marginBottom:'6px',color:'#000080'}}>Classificação Geral de Pombos - {pombosTotais.tipoProva}</div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',marginBottom:'4px',border:'1px solid #000',padding:'4px',backgroundColor:'#e8e8e8'}}>
                <span><b>Ano:</b> {concurso.ano} <b>Tipo:</b> {pombosTotais.tipoProva} <b>Provas:</b> {pombosTotais.provas}</span>
                <span><b>Grupo:</b> {pombosTotais.grupo || 'Todos'}</span>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'10px'}}>
                <thead><tr style={{backgroundColor:'#c0c0c0'}}><th style={{border:'1px solid #000',padding:'3px'}}>Lugar</th><th style={{border:'1px solid #000',padding:'3px'}}>Anilha</th><th style={{border:'1px solid #000',padding:'3px'}}>Pombo</th><th style={{border:'1px solid #000',padding:'3px'}}>Concorrente</th><th style={{border:'1px solid #000',padding:'3px'}}>Pontos</th><th style={{border:'1px solid #000',padding:'3px'}}>Coef.</th></tr></thead>
                <tbody>
                  <tr><td style={{border:'1px solid #000',textAlign:'center',fontWeight:'bold',backgroundColor:'#ffffc0'}}>1</td><td style={{border:'1px solid #000',textAlign:'center'}}>0084701/20</td><td style={{border:'1px solid #000'}}>Macho Azul</td><td style={{border:'1px solid #000'}}>33/1508 BORDIN & MARQUINHO</td><td style={{border:'1px solid #000',textAlign:'center',fontWeight:'bold'}}>486</td><td style={{border:'1px solid #000',textAlign:'center'}}>8,42</td></tr>
                  <tr><td style={{border:'1px solid #000',textAlign:'center'}}>2</td><td style={{border:'1px solid #000',textAlign:'center'}}>2320071/23</td><td style={{border:'1px solid #000'}}>Fêmea Branca</td><td style={{border:'1px solid #000'}}>33/81 VILMAR ALMEIDA PORTA DO SOL</td><td style={{border:'1px solid #000',textAlign:'center'}}>472</td><td style={{border:'1px solid #000',textAlign:'center'}}>10,15</td></tr>
                  <tr><td style={{border:'1px solid #000',textAlign:'center'}}>3</td><td style={{border:'1px solid #000',textAlign:'center'}}>233027/23</td><td style={{border:'1px solid #000'}}>Macho Preto</td><td style={{border:'1px solid #000'}}>33/283 GLAUCION CLAITO SILVA</td><td style={{border:'1px solid #000',textAlign:'center'}}>458</td><td style={{border:'1px solid #000',textAlign:'center'}}>12,33</td></tr>
                  <tr><td style={{border:'1px solid #000',textAlign:'center'}}>4</td><td style={{border:'1px solid #000',textAlign:'center'}}>1134642/21</td><td style={{border:'1px solid #000'}}>Fêmea Rodada</td><td style={{border:'1px solid #000'}}>33/91 EDSON ROBERTO DA SILVA</td><td style={{border:'1px solid #000',textAlign:'center'}}>445</td><td style={{border:'1px solid #000',textAlign:'center'}}>14,20</td></tr>
                </tbody>
              </table>
              <div style={{textAlign:'center',fontSize:'10px',marginTop:'8px',fontStyle:'italic'}}>Classificação Geral de Pombos - {pombosTotais.tipoProva} - {pombosTotais.provas}</div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:'8px',fontSize:'10px',backgroundColor:'#c0c0c0',padding:'4px 6px',border:'1px solid #808080',alignItems:'center'}}>
                <span>{pombosTotais.melhores==='99999' ? 'Todos os pombos' : 'Top '+pombosTotais.melhores}</span>
                <span><button style={s.btn} onClick={()=>close('pombosTotaisResult')}>Sair</button></span>
              </div>
            </div>
          </div>
        )}
                {wins.includes('pombosFeWin') && (
          <div style={{...s.win,width:'620px'}}>
            <div style={s.winTitle}><span>Pombos de Fé - Classificação</span><button onClick={()=>close('pombosFeWin')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'6px'}}>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                <label>Do concurso :</label>
                <input value={pombosFe.ano} onChange={e=>setPombosFe({...pombosFe,ano:e.target.value})} style={{...s.field,width:'50px',backgroundColor:'#b0d0ff',fontWeight:'bold'}} />/<input value={pombosFe.num} onChange={e=>setPombosFe({...pombosFe,num:e.target.value})} style={{...s.field,width:'40px'}} />
                <button style={s.tbtn} onClick={()=>{setLupaTarget('pombosFeConcurso'); setLupaConcurso(true);}} title="Pesquisar concurso">🔍</button>
                <input value={pombosFe.nome} onChange={e=>setPombosFe({...pombosFe,nome:e.target.value})} style={{...s.field,flex:1,fontWeight:'bold'}} />
              </div>
              <div style={{border:'2px groove #fff',padding:'6px',marginBottom:'6px'}}>
                <div style={{display:'grid',gridTemplateColumns:'80px 120px 80px 120px',gap:'6px',alignItems:'center'}}>
                  <label>Tipo :</label><input value={pombosFe.tipo} readOnly style={{...s.field,backgroundColor:'#ffd0d0',fontWeight:'bold',textAlign:'center',color:'#800000'}} />
                  <label>Latitude :</label><input value={concurso.lat} readOnly style={{...s.field,backgroundColor:'#e8e8e8'}} />
                  <label>Data :</label><input value={concurso.data} readOnly style={{...s.field,backgroundColor:'#e8e8e8'}} />
                  <label>Longitude :</label><input value={concurso.lon} readOnly style={{...s.field,backgroundColor:'#e8e8e8'}} />
                </div>
                <div style={{display:'flex',gap:'8px',marginTop:'6px',alignItems:'center',flexWrap:'wrap'}}>
                  <label>Do concurso :</label><input value={pombosFe.de} onChange={e=>setPombosFe({...pombosFe,de:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                  <label>ao concurso :</label><input value={pombosFe.ate} onChange={e=>setPombosFe({...pombosFe,ate:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                  <span style={{flex:1,backgroundColor:'#e8e8e8',border:'2px inset #fff',padding:'2px 6px'}}>{concurso.nome} - {pombosFe.de} a {pombosFe.ate}</span>
                </div>
                <div style={{display:'flex',gap:'10px',marginTop:'6px',alignItems:'center'}}>
                  <label>Critério :</label><label><input type="radio" checked={pombosFe.criterio==='Pontos'} onChange={()=>setPombosFe({...pombosFe,criterio:'Pontos'})} /> Pontos</label><label><input type="radio" checked={pombosFe.criterio==='Coeficiente'} onChange={()=>setPombosFe({...pombosFe,criterio:'Coeficiente'})} /> Coeficiente</label>
                  <label style={{marginLeft:'12px'}}>Destino :</label><label><input type="radio" checked={pombosFe.destino==='Impressora'} onChange={()=>setPombosFe({...pombosFe,destino:'Impressora'})} /> Impressora</label><label><input type="radio" checked={pombosFe.destino==='Ficheiro Excel'} onChange={()=>setPombosFe({...pombosFe,destino:'Ficheiro Excel'})} /> Ficheiro Excel</label>
                </div>
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'12px'}}>
                <button style={{...s.btn,minWidth:'80px'}} onClick={()=>open('pombosFeResult')}>Confirmar</button>
                <button style={{...s.btn,minWidth:'80px'}} onClick={()=>close('pombosFeWin')}>Sair</button>
              </div>
            </div>
          </div>
        )}
        {wins.includes('pombosFeResult') && (
          <div style={{...s.win,width:'880px'}}>
            <div style={s.winTitle}><span>CLUBE COLUMBOMFILO LIMEIRENSE - Pombos de Fe - {pombosFe.criterio}</span><button onClick={()=>close('pombosFeResult')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,backgroundColor:'#fff',fontFamily:'Arial',fontSize:'11px'}}>
              <div style={{textAlign:'center',fontWeight:'bold',color:'#008080',fontSize:'14px',fontStyle:'italic'}}>CLUBE COLUMBOMFILO LIMEIRENSE</div>
              <div style={{textAlign:'center',fontWeight:'bold',fontSize:'12px',marginBottom:'6px',color:'#000080'}}>Pombos de Fe - Classificacao - {pombosFe.tipo} - Criterio: {pombosFe.criterio}</div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',marginBottom:'4px',border:'1px solid #000',padding:'4px',backgroundColor:'#e8e8e8'}}>
                <span><b>Ano:</b> {concurso.ano} <b>Concursos:</b> {pombosFe.de} a {pombosFe.ate} - {pombosFe.nome}</span>
                <span><b>Tipo:</b> {pombosFe.tipo} <b>Ate:</b> {concurso.ano}/{pombosFe.ate} - {pombosFe.nome}</span>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'10px'}}>
                <thead><tr style={{backgroundColor:'#000080',color:'#fff'}}><th style={{border:'1px solid #000',padding:'3px'}}>Lugar</th><th style={{border:'1px solid #000',padding:'3px'}}>Concorrente</th><th style={{border:'1px solid #000',padding:'3px'}}>Licenca</th><th style={{border:'1px solid #000',padding:'3px'}}>Anilha - Pombo de Fe</th><th style={{border:'1px solid #000',padding:'3px'}}>Pontos</th><th style={{border:'1px solid #000',padding:'3px'}}>Coef.</th></tr></thead>
                <tbody>
                  <tr style={{backgroundColor:'#ffffc0'}}><td style={{border:'1px solid #000',textAlign:'center',fontWeight:'bold'}}>1</td><td style={{border:'1px solid #000'}}>BORDIN & MARQUINHO</td><td style={{border:'1px solid #000',textAlign:'center'}}>33/1508</td><td style={{border:'1px solid #000',textAlign:'center',fontWeight:'bold'}}>0084701/20 - Femea Azul</td><td style={{border:'1px solid #000',textAlign:'center',fontWeight:'bold'}}>298</td><td style={{border:'1px solid #000',textAlign:'center'}}>5,22</td></tr>
                  <tr><td style={{border:'1px solid #000',textAlign:'center'}}>2</td><td style={{border:'1px solid #000'}}>VILMAR ALMEIDA PORTA DO SOL</td><td style={{border:'1px solid #000',textAlign:'center'}}>33/81</td><td style={{border:'1px solid #000',textAlign:'center'}}>233027/23 - Macho Preto</td><td style={{border:'1px solid #000',textAlign:'center'}}>285</td><td style={{border:'1px solid #000',textAlign:'center'}}>6,80</td></tr>
                  <tr><td style={{border:'1px solid #000',textAlign:'center'}}>3</td><td style={{border:'1px solid #000'}}>GLAUCION CLAITO SILVA</td><td style={{border:'1px solid #000',textAlign:'center'}}>33/283</td><td style={{border:'1px solid #000',textAlign:'center'}}>1134642/21 - Femea Rodada</td><td style={{border:'1px solid #000',textAlign:'center'}}>272</td><td style={{border:'1px solid #000',textAlign:'center'}}>7,15</td></tr>
                  <tr><td style={{border:'1px solid #000',textAlign:'center'}}>4</td><td style={{border:'1px solid #000'}}>EDSON ROBERTO DA SILVA</td><td style={{border:'1px solid #000',textAlign:'center'}}>33/91</td><td style={{border:'1px solid #000',textAlign:'center'}}>0084751/20 - Macho Cinza</td><td style={{border:'1px solid #000',textAlign:'center'}}>260</td><td style={{border:'1px solid #000',textAlign:'center'}}>8,33</td></tr>
                </tbody>
              </table>
              <div style={{textAlign:'center',fontSize:'10px',marginTop:'6px',fontStyle:'italic'}}>Pombos de Fe - Cada concorrente indica 1 pombo de fe por epoca - Criterio {pombosFe.criterio}</div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:'8px',fontSize:'10px',backgroundColor:'#c0c0c0',padding:'4px 6px',border:'1px solid #808080',alignItems:'center'}}>
                <span>Pombos de Fe - {pombosFe.de} a {pombosFe.ate} - {pombosFe.tipo}</span>
                <span><button style={s.btn} onClick={()=>{ const csv='Pombos de Fe\nLugar;Concorrente;Anilha;Pontos\n1;BORDIN;0084701/20;298\n'; const b=new Blob([csv],{type:'text/csv'}); const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download='POMBOS_FE_'+concurso.ano+'.csv'; a.click(); URL.revokeObjectURL(u); }}>Exportar Excel</button> <button style={{...s.btn,marginLeft:'6px'}} onClick={()=>close('pombosFeResult')}>Sair</button></span>
              </div>
            </div>
          </div>
        )}
        
        {/* ===== LUPAS GLOBAIS - FUNCIONAM EM TODAS AS JANELAS ===== */}
        {lupaConcorrente && (
          <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}} onClick={()=>setLupaConcorrente(false)}>
            <div style={{backgroundColor:'#c0c0c0',border:'2px outset #fff',width:'520px',padding:'8px'}} onClick={e=>e.stopPropagation()}>
              <div style={{...s.winTitle,margin:'-8px -8px 8px -8px'}}><span>🔍 Pesquisar Concorrente</span><button style={s.tbtn} onClick={()=>setLupaConcorrente(false)}>X</button></div>
              <div style={{maxHeight:'300px',overflowY:'auto',border:'2px inset #fff',backgroundColor:'#fff'}}>
                {socios.map(sc=>(
                  <div key={sc.id} onClick={()=>{
                    const lic=sc.lic.split('/');
                    const concorrentesMatch = concorrentesLista.find(c=>c.num===String(sc.id));
                    if(lupaTarget==='concDe'){ setClassTot({...classTot,de1:lic[0]||'11',de2:lic[1]||'33',de3:String(sc.id),deNome:sc.nome}); }
                    else if(lupaTarget==='concAte'){ setClassTot({...classTot,ate1:lic[0]||'11',ate2:lic[1]||'33',ate3:String(sc.id),ateNome:sc.nome}); }
                    else if(lupaTarget==='pombosFeConc'){ setPomboAs({...pomboAs,concDe:String(sc.id)}); }
                    else if(lupaTarget==='formConcorrente'){ setForm({...form,concorrente:String(sc.id)}); }
                    else if(lupaTarget==='pombosApagar'){ setApagarConc({...apagarConc,conc3:String(sc.id)}); }
                    else if(lupaTarget==='distDe'){ setDistParams({...distParams,deConc1:lic[0]||'11',deConc2:lic[1]||'33',deConc3:String(sc.id),deNome:sc.nome}); }
                    else if(lupaTarget==='distAte'){ setDistParams({...distParams,ateConc1:lic[0]||'11',ateConc2:lic[1]||'33',ateConc3:String(sc.id),ateNome:sc.nome}); }
                    else if(lupaTarget==='pombosEnvConcorrente'){ setPombosEnv({...pombosEnv,assoc:lic[0]||'11',colec:lic[1]||'33'}); }
                    else if(lupaTarget==='listPombosDe'){ setListPombosWin({...listPombosWin,deAssoc:lic[0]||'11',deColec:lic[1]||'33',deNum:String(sc.id),deNome:sc.nome}); }
                    else if(lupaTarget==='listPombosAte'){ setListPombosWin({...listPombosWin,ateAssoc:lic[0]||'11',ateColec:lic[1]||'33',ateNum:String(sc.id),ateNome:sc.nome}); }
                    else if(lupaTarget==='manutencaoPombos'){ setPomboEdit({...pomboEdit,assoc:lic[0]||'11',colec:lic[1]||'33',num:String(sc.id),nome:sc.nome}); }
                    else if(lupaTarget==='generic'){ setForm({...form,concorrente:String(sc.id)}); if(concorrentesMatch){ setPomboEdit({...pomboEdit,assoc:concorrentesMatch.assoc,colec:concorrentesMatch.col,num:concorrentesMatch.num,nome:concorrentesMatch.nome}); } }
                    else { setForm({...form,concorrente:String(sc.id)}); if(concorrentesMatch){ setPomboEdit({...pomboEdit,assoc:concorrentesMatch.assoc,colec:concorrentesMatch.col,num:concorrentesMatch.num,nome:concorrentesMatch.nome}); } }
                    setLupaConcorrente(false); setMsg('Concorrente selecionado: '+sc.nome);
                  }} style={{padding:'6px',borderBottom:'1px solid #c0c0c0',cursor:'pointer',display:'flex',justifyContent:'space-between'}}>
                    <span><b>{sc.lic}</b> - {sc.nome}</span><span style={{color:'#000080'}}>{sc.ass}</span>
                  </div>
                ))}
              </div>
              <div style={{textAlign:'right',marginTop:'8px'}}><button style={s.btn} onClick={()=>setLupaConcorrente(false)}>Sair</button></div>
            </div>
          </div>
        )}
        {lupaGrupo && (
          <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}} onClick={()=>setLupaGrupo(false)}>
            <div style={{backgroundColor:'#c0c0c0',border:'2px outset #fff',width:'400px',padding:'8px'}} onClick={e=>e.stopPropagation()}>
              <div style={{...s.winTitle,margin:'-8px -8px 8px -8px'}}><span>🏢 Pesquisar Grupo</span><button style={s.tbtn} onClick={()=>setLupaGrupo(false)}>X</button></div>
              {[
                {id:'0', nome:'(todos os grupos)'},
                {id:'1', nome:'Grupo A - Velocidade'},
                {id:'2', nome:'Grupo B - Meio Fundo'},
                {id:'3', nome:'Grupo C - Fundo'},
                {id:'4', nome:'Grupo D - Filhotes'},
              ].map(g=>(
                <div key={g.id} onClick={()=>{
                  if(lupaTarget==='concGrupo') setConcTotais({...concTotais,grupo:g.nome});
                  else if(lupaTarget==='pombosGrupo') setPombosTotais({...pombosTotais,grupo:g.nome});
                  setLupaGrupo(false); setMsg('Grupo selecionado: '+g.nome);
                }} style={{padding:'6px',borderBottom:'1px solid #808080',cursor:'pointer',backgroundColor:'#fff'}}>{g.nome}</div>
              ))}
              <div style={{textAlign:'right',marginTop:'8px'}}><button style={s.btn} onClick={()=>setLupaGrupo(false)}>Sair</button></div>
            </div>
          </div>
        )}
        
        {/* ===== TABELA DE CONCURSOS - FIEL AO PRINT 2014 ===== */}
        {wins.includes('tabelaConcursos') && (
          <div style={{...s.win,width:'760px'}}>
            <div style={s.winTitle}><span>Tabela de Concursos</span><button onClick={()=>close('tabelaConcursos')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'0'}}>
              <div style={{display:'flex',backgroundColor:'#c0c0c0',borderBottom:'1px solid #808080'}}>
                {['Editar','Consultar','Horas de Solta'].map(tab=> (
                  <button key={tab} onClick={()=>setConcursoTab(tab)} style={{padding:'4px 12px',border:'1px solid #808080',borderBottom: concursoTab===tab ? '1px solid #c0c0c0' : '1px solid #808080',backgroundColor: concursoTab===tab ? '#c0c0c0' : '#a0a0a0',fontWeight: concursoTab===tab ? 'bold':'normal',marginRight:'2px'}}>{tab}</button>
                ))}
              </div>
              {concursoTab==='Editar' && (
                <div style={{padding:'8px'}}>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                    <label style={{fontWeight:'bold'}}>Ano / Numero :</label>
                    <input value={concursoEdit.ano} onChange={e=>setConcursoEdit({...concursoEdit,ano:e.target.value})} style={{...s.field,width:'50px',backgroundColor:'#b0d0ff',fontWeight:'bold',textAlign:'center'}} />
                    <span>/</span>
                    <input value={concursoEdit.num} onChange={e=>setConcursoEdit({...concursoEdit,num:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                  </div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                    <label style={{width:'50px'}}>Nome :</label>
                    <button style={s.tbtn} onClick={()=>setLupaConcurso(true)}>🏢</button>
                    <input value={concursoEdit.nome} onChange={e=>setConcursoEdit({...concursoEdit,nome:e.target.value})} style={{...s.field,flex:1,backgroundColor:'#fff',fontWeight:'bold'}} />
                  </div>
                  <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'6px',flexWrap:'wrap'}}>
                    <label>Data :</label><input value={concursoEdit.data} onChange={e=>setConcursoEdit({...concursoEdit,data:e.target.value})} placeholder="  /  /" style={{...s.field,width:'90px'}} />
                    <label>Número de Concorrentes :</label><input value={concursoEdit.numConc} onChange={e=>setConcursoEdit({...concursoEdit,numConc:e.target.value})} style={{...s.field,width:'50px',textAlign:'center'}} />
                  </div>
                  <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'4px'}}>
                    <label>Prova com prémios monetários ?</label><label><input type="radio" checked={concursoEdit.premios==='Sim'} onChange={()=>setConcursoEdit({...concursoEdit,premios:'Sim'})} /> Sim</label><label><input type="radio" checked={concursoEdit.premios==='Não'} onChange={()=>setConcursoEdit({...concursoEdit,premios:'Não'})} /> Não</label>
                  </div>
                  <div style={{border:'1px solid #808080',padding:'4px',marginBottom:'4px',backgroundColor:'#d4d0c8'}}>
                    <label>Tipo :</label>
                    <label style={{marginLeft:'8px'}}><input type="radio" checked={concursoEdit.tipo==='Velocidade'} onChange={()=>setConcursoEdit({...concursoEdit,tipo:'Velocidade'})} /> Velocidade</label>
                    <label><input type="radio" checked={concursoEdit.tipo==='Meio Fundo'} onChange={()=>setConcursoEdit({...concursoEdit,tipo:'Meio Fundo'})} /> Meio Fundo</label>
                    <label><input type="radio" checked={concursoEdit.tipo==='Fundo'} onChange={()=>setConcursoEdit({...concursoEdit,tipo:'Fundo'})} /> Fundo</label>
                    <label><input type="radio" checked={concursoEdit.tipo==='Grande Fundo'} onChange={()=>setConcursoEdit({...concursoEdit,tipo:'Grande Fundo'})} /> Grande Fundo</label>
                  </div>
                  <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'4px',flexWrap:'wrap'}}>
                    <label>Prova Oficial :</label><label><input type="radio" checked={concursoEdit.oficial==='Sim'} onChange={()=>setConcursoEdit({...concursoEdit,oficial:'Sim'})} /> Sim</label><label><input type="radio" checked={concursoEdit.oficial==='Não'} onChange={()=>setConcursoEdit({...concursoEdit,oficial:'Não'})} /> Não</label>
                    <button style={s.tbtn}>📊</button><input style={{...s.field,flex:1,backgroundColor:'#e8e8e8'}} readOnly />
                  </div>
                  <div style={{display:'flex',gap:'12px',alignItems:'center',marginBottom:'4px'}}>
                    <label>Pontos para Pombos?</label><label><input type="radio" checked={concursoEdit.pontosPombos==='Não'} onChange={()=>setConcursoEdit({...concursoEdit,pontosPombos:'Não'})} /> Não</label><label><input type="radio" checked={concursoEdit.pontosPombos==='Sim'} onChange={()=>setConcursoEdit({...concursoEdit,pontosPombos:'Sim'})} /> Sim</label>
                    <label>Pontos para Concorrentes?</label><label><input type="radio" checked={concursoEdit.pontosConc==='Não'} onChange={()=>setConcursoEdit({...concursoEdit,pontosConc:'Não'})} /> Não</label><label><input type="radio" checked={concursoEdit.pontosConc==='Sim'} onChange={()=>setConcursoEdit({...concursoEdit,pontosConc:'Sim'})} /> Sim</label>
                  </div>
                  <div style={{border:'1px solid #808080',padding:'4px',marginBottom:'4px'}}>
                    <div style={{fontWeight:'bold',textAlign:'center',fontSize:'10px'}}>Tempos Mortos</div>
                    <div style={{display:'flex',gap:'12px',marginTop:'4px',justifyContent:'center'}}>
                      <label>1ª noite : <input value={concursoEdit.noite1} onChange={e=>setConcursoEdit({...concursoEdit,noite1:e.target.value})} style={{...s.field,width:'70px',textAlign:'center'}} /></label>
                      <label>2ª noite : <input value={concursoEdit.noite2} onChange={e=>setConcursoEdit({...concursoEdit,noite2:e.target.value})} style={{...s.field,width:'70px',textAlign:'center'}} /></label>
                      <label>3ª noite : <input value={concursoEdit.noite3} onChange={e=>setConcursoEdit({...concursoEdit,noite3:e.target.value})} style={{...s.field,width:'70px',textAlign:'center'}} /></label>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:'6px',marginBottom:'6px'}}>
                    <div style={{border:'1px solid #808080',padding:'4px',flex:1,textAlign:'center'}}>
                      <div style={{fontWeight:'bold',fontSize:'10px'}}>Hora de Solta</div>
                      <input value={concursoEdit.horaSolta} onChange={e=>setConcursoEdit({...concursoEdit,horaSolta:e.target.value})} style={{...s.field,width:'80px',textAlign:'center',fontWeight:'bold',marginTop:'4px'}} />
                    </div>
                    <div style={{border:'1px solid #808080',padding:'4px',flex:2}}>
                      <div style={{fontWeight:'bold',fontSize:'10px'}}>Obs</div>
                      <textarea value={concursoEdit.obs} onChange={e=>setConcursoEdit({...concursoEdit,obs:e.target.value})} style={{...s.field,width:'100%',height:'40px',resize:'none'}} />
                    </div>
                  </div>
                  <div style={{border:'1px solid #808080',padding:'4px',marginBottom:'6px'}}>
                    <div style={{fontWeight:'bold',textAlign:'center',fontSize:'10px'}}>Coordenadas</div>
                    <div style={{display:'flex',gap:'8px',marginTop:'4px',justifyContent:'center',alignItems:'center'}}>
                      <label>Latitude :</label><input value={concursoEdit.latG} onChange={e=>setConcursoEdit({...concursoEdit,latG:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} /><input value={concursoEdit.latM} onChange={e=>setConcursoEdit({...concursoEdit,latM:e.target.value})} style={{...s.field,width:'30px',textAlign:'center'}} /><input value={concursoEdit.latS} onChange={e=>setConcursoEdit({...concursoEdit,latS:e.target.value})} style={{...s.field,width:'50px',textAlign:'center'}} />
                      <label>Longitude :</label><input value={concursoEdit.lonG} onChange={e=>setConcursoEdit({...concursoEdit,lonG:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} /><input value={concursoEdit.lonM} onChange={e=>setConcursoEdit({...concursoEdit,lonM:e.target.value})} style={{...s.field,width:'30px',textAlign:'center'}} /><input value={concursoEdit.lonS} onChange={e=>setConcursoEdit({...concursoEdit,lonS:e.target.value})} style={{...s.field,width:'50px',textAlign:'center'}} />
                    </div>
                  </div>
                  <div style={{display:'flex',justifyContent:'center',gap:'6px'}}>
                    <button style={s.btn} onClick={()=>setMsg('Novo concurso criado')}>Novo</button>
                    <button style={{...s.btn,backgroundColor:'#c0ffc0'}} onClick={salvarConcurso}>Guardar</button>
                    <button style={s.btn}>Desfazer</button>
                    <button style={{...s.btn,backgroundColor:'#ffc0c0'}}>Anular</button>
                    <button style={s.btn} onClick={()=>open('listagemConcursosPreview')}>Imprimir</button>
                    <button style={s.btn} onClick={()=>close('tabelaConcursos')}>Sair</button>
                  </div>
                </div>
              )}
              {concursoTab==='Consultar' && (
                <div style={{padding:'8px'}}>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                    <label style={{fontWeight:'bold'}}>Ano / Numero :</label>
                    <input placeholder="0" style={{...s.field,width:'40px',backgroundColor:'#b0d0ff',textAlign:'center'}} />/<input placeholder="0" style={{...s.field,width:'30px',textAlign:'center'}} />
                    <span style={{marginLeft:'12px',color:'#800000',fontSize:'10px'}}>Selecione um concurso para editar</span>
                  </div>
                  <div style={{border:'2px inset #fff',backgroundColor:'#fff',height:'260px',overflowY:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px'}}>
                      <thead><tr style={{backgroundColor:'#000080',color:'#fff',position:'sticky',top:0}}><th style={{border:'1px solid #808080',padding:'3px'}}>Ano</th><th style={{border:'1px solid #808080',padding:'3px'}}>Num.</th><th style={{border:'1px solid #808080',padding:'3px'}}>Nome</th></tr></thead>
                      <tbody>{concursosLista.map(c=>(
                        <tr key={c.ano+'/'+c.num} onClick={()=>{setConcursoEdit({ano:c.ano,num:c.num,nome:c.nome,data:c.data, numConc:'8', premios:'Sim',tipo:c.tipo,oficial:'Sim',pontosPombos:'Sim',pontosConc:'Sim',noite1:'00:00:00',noite2:'00:00:00',noite3:'00:00:00',horaSolta:'07:40:00',obs:'',latG:'021',latM:'19',latS:'45.0',lonG:'047',lonM:'42',lonS:'58.3'}); setConcursoTab('Editar'); setMsg('Concurso '+c.ano+'/'+c.num+' '+c.nome+' carregado');}} style={{cursor:'pointer'}}><td style={{border:'1px solid #c0c0c0',padding:'2px 6px',textAlign:'center'}}>{c.ano}</td><td style={{border:'1px solid #c0c0c0',padding:'2px 6px',textAlign:'center'}}>{c.num}</td><td style={{border:'1px solid #c0c0c0',padding:'2px 6px'}}>{c.nome}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                  <div style={{display:'flex',justifyContent:'center',gap:'8px',marginTop:'6px'}}>
                    <button style={s.btn} onClick={()=>setConcursoTab('Editar')}>Editar</button>
                    <button style={s.btn} onClick={()=>close('tabelaConcursos')}>Sair</button>
                  </div>
                </div>
              )}
              {concursoTab==='Horas de Solta' && (
                <div style={{padding:'20px',textAlign:'center'}}>
                  <div style={{fontWeight:'bold',marginBottom:'12px'}}>Horas de Solta - Em desenvolvimento</div>
                  <div style={{fontSize:'11px',color:'#800000'}}>Tabela de horários de solta por concurso será implementada em breve.</div>
                  <button style={{...s.btn,marginTop:'12px'}} onClick={()=>setConcursoTab('Editar')}>Voltar</button>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* LISTAGEM DE CONCURSOS - PARAMETROS */}
        {wins.includes('listagemConcursosWin') && (
          <div style={{...s.win,width:'620px'}}>
            <div style={s.winTitle}><span>Listagem de Concursos</span><button onClick={()=>close('listagemConcursosWin')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'6px'}}>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}>
                <label>Do concurso :</label>
                <input value={listConcParams.deAno} onChange={e=>setListConcParams({...listConcParams,deAno:e.target.value})} style={{...s.field,width:'50px',backgroundColor:'#b0d0ff',textAlign:'center',fontWeight:'bold'}} />/<input value={listConcParams.deNum} onChange={e=>setListConcParams({...listConcParams,deNum:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                <span style={{flex:1,backgroundColor:'#e8e8e8',border:'2px inset #fff',padding:'2px 6px',fontWeight:'bold',color:'#000080'}}>{concursosLista.find(c=>c.num===listConcParams.deNum)?.nome || 'Cravinhos-Sp'}</span>
                <button style={s.tbtn} onClick={()=>{setLupaTarget('listConcDe'); setLupaConcurso(true);}} title="Pesquisar concurso">Lupa</button>
              </div>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                <label>ao concurso :</label>
                <input value={listConcParams.ateAno} onChange={e=>setListConcParams({...listConcParams,ateAno:e.target.value})} style={{...s.field,width:'50px',textAlign:'center'}} />/<input value={listConcParams.ateNum} onChange={e=>setListConcParams({...listConcParams,ateNum:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                <span style={{flex:1,backgroundColor:'#e8e8e8',border:'2px inset #fff',padding:'2px 6px',fontWeight:'bold',color:'#000080'}}>{concursosLista.find(c=>c.num===listConcParams.ateNum)?.nome || 'Brasilia-DF'}</span>
                <button style={s.tbtn} onClick={()=>{setLupaTarget('listConcAte'); setLupaConcurso(true);}} title="Pesquisar concurso">Lupa</button>
              </div>
              <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'4px'}}>
                <label>Da data :</label><input value={listConcParams.daData} onChange={e=>setListConcParams({...listConcParams,daData:e.target.value})} placeholder="  /  /" style={{...s.field,width:'80px'}} />
                <label>à data :</label><input value={listConcParams.ateData} onChange={e=>setListConcParams({...listConcParams,ateData:e.target.value})} style={{...s.field,width:'80px'}} />
              </div>
              <div style={{border:'1px solid #808080',padding:'4px',marginBottom:'4px',backgroundColor:'#d4d0c8',display:'flex',gap:'8px',flexWrap:'wrap'}}>
                <label>Concurso de :</label>
                {['Velocidade','Meio Fundo','Fundo','Grande Fundo','Todos'].map(t=> <label key={t}><input type="radio" checked={listConcParams.concursoTipo===t} onChange={()=>setListConcParams({...listConcParams,concursoTipo:t})} /> {t.match(/Grande/)?'Grande Fundo':t}</label>)}
              </div>
              <div style={{border:'1px solid #808080',padding:'4px',marginBottom:'4px',display:'flex',gap:'12px'}}>
                <label>Provas Oficiais :</label><label><input type="radio" checked={listConcParams.provasOficiais==='Sim'} onChange={()=>setListConcParams({...listConcParams,provasOficiais:'Sim'})} /> Sim</label><label><input type="radio" checked={listConcParams.provasOficiais==='Não'} onChange={()=>setListConcParams({...listConcParams,provasOficiais:'Não'})} /> Não</label><label><input type="radio" checked={listConcParams.provasOficiais==='Todas'} onChange={()=>setListConcParams({...listConcParams,provasOficiais:'Todas'})} /> Todas</label>
              </div>
              <div style={{display:'flex',gap:'12px',marginBottom:'4px'}}>
                <div style={{border:'1px solid #808080',padding:'4px',flex:1}}>
                  <div style={{fontWeight:'bold',fontSize:'10px',textAlign:'center'}}>Tipo</div>
                  <label><input type="radio" checked={listConcParams.tipo==='Simples'} onChange={()=>setListConcParams({...listConcParams,tipo:'Simples'})} /> Simples</label><label style={{marginLeft:'8px'}}><input type="radio" checked={listConcParams.tipo==='Detalhada'} onChange={()=>setListConcParams({...listConcParams,tipo:'Detalhada'})} /> Detalhada</label>
                </div>
                <div style={{border:'1px solid #808080',padding:'4px',flex:1}}>
                  <div style={{fontWeight:'bold',fontSize:'10px',textAlign:'center'}}>Ordenação</div>
                  <label><input type="radio" checked={listConcParams.ordenacao==='Numérica'} onChange={()=>setListConcParams({...listConcParams,ordenacao:'Numérica'})} /> Numérica</label><label style={{marginLeft:'8px'}}><input type="radio" checked={listConcParams.ordenacao==='Alfabética'} onChange={()=>setListConcParams({...listConcParams,ordenacao:'Alfabética'})} /> Alfabética</label>
                </div>
              </div>
              <div style={{border:'2px groove #fff',padding:'4px',backgroundColor:'#d4d0c8',marginBottom:'6px',display:'flex',gap:'8px',alignItems:'center'}}>
                <label>Destino :</label><label><input type="radio" checked={listConcParams.destino==='Impressora'} onChange={()=>setListConcParams({...listConcParams,destino:'Impressora'})} /> Impressora</label><label><input type="radio" checked={listConcParams.destino==='Ficheiro Excel'} onChange={()=>setListConcParams({...listConcParams,destino:'Ficheiro Excel'})} /> Ficheiro Excel</label><input placeholder="C:\\SGSP\\EXP\\" style={{...s.field,flex:1}} />
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'12px'}}>
                <button style={{...s.btn,minWidth:'90px'}} onClick={()=>open('listagemConcursosPreview')}>Imprimir</button>
                <button style={{...s.btn,minWidth:'90px'}} onClick={()=>close('listagemConcursosWin')}>Sair</button>
              </div>
            </div>
          </div>
        )}
        {wins.includes('listagemConcursosPreview') && (
          <div style={{...s.win,width:'820px'}}>
            <div style={s.winTitle}><span>Print Preview - Listagem de Concursos</span><button onClick={()=>close('listagemConcursosPreview')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,backgroundColor:'#fff',fontFamily:'Arial',fontSize:'11px'}}>
              <div style={{display:'flex',gap:'4px',alignItems:'center',backgroundColor:'#c0c0c0',border:'1px solid #808080',padding:'3px 6px',margin:'-8px -8px 6px -8px'}}><button style={{...s.tbtn,padding:'1px 4px'}}>|&lt;&lt;</button><button style={{...s.tbtn,padding:'1px 4px'}}>&lt;</button><button style={{...s.tbtn,padding:'1px 4px'}}>&gt;</button><button style={{...s.tbtn,padding:'1px 4px'}}>&gt;&gt;|</button><select style={{...s.field,marginLeft:'8px'}}><option>100%</option></select><button style={s.tbtn}>Print</button></div>
              <div style={{textAlign:'center',fontWeight:'bold',color:'#008080',fontSize:'12px'}}>Ano 2014</div>
              <div style={{textAlign:'center',fontWeight:'bold',fontSize:'11px'}}>Listagem de Concursos, por ordem numerica.</div>
              <div style={{fontSize:'10px',marginTop:'6px'}}>De concurso {listConcParams.deAno}/{listConcParams.deNum} - {concursosLista.find(c=>c.num===listConcParams.deNum)?.nome} ao concurso {listConcParams.ateAno}/{listConcParams.ateNum} - {concursosLista.find(c=>c.num===listConcParams.ateNum)?.nome}<br/>Da data {listConcParams.daData || '  /  /'} &agrave; data {listConcParams.ateData}<br/>Concursos {listConcParams.concursoTipo} - Provas {listConcParams.provasOficiais}</div>
              <table style={{width:'100%',borderCollapse:'collapse',marginTop:'6px',fontSize:'10px'}}>
                <thead><tr style={{backgroundColor:'#c0c0c0'}}><th style={{border:'1px solid #000',padding:'3px'}}>Ano</th><th style={{border:'1px solid #000',padding:'3px'}}>Numero</th><th style={{border:'1px solid #000',padding:'3px'}}>Nome</th><th style={{border:'1px solid #000',padding:'3px'}}>Data</th><th style={{border:'1px solid #000',padding:'3px'}}>Tipo</th><th style={{border:'1px solid #000',padding:'3px'}}>Oficial</th></tr></thead>
                <tbody>{concursosLista.slice(0,16).map(c=> (<tr key={c.num}><td style={{border:'1px solid #c0c0c0',padding:'2px 4px',textAlign:'center'}}>{c.ano}</td><td style={{border:'1px solid #c0c0c0',padding:'2px 4px',textAlign:'center'}}>{c.num}</td><td style={{border:'1px solid #c0c0c0',padding:'2px 4px'}}>{c.nome}</td><td style={{border:'1px solid #c0c0c0',padding:'2px 4px',textAlign:'center'}}>{c.data}</td><td style={{border:'1px solid #c0c0c0',padding:'2px 4px',textAlign:'center'}}>{c.tipo}</td><td style={{border:'1px solid #c0c0c0',padding:'2px 4px',textAlign:'center'}}>{c.oficial}</td></tr>))}</tbody>
              </table>
              <div style={{display:'flex',justifyContent:'flex-end',marginTop:'8px'}}><button style={s.btn} onClick={()=>close('listagemConcursosPreview')}>Sair</button></div>
            </div>
          </div>
        )}
        {/* LISTAGEM DE DISTANCIAS */}
        {wins.includes('listagemDistanciasWin') && (
          <div style={{...s.win,width:'640px'}}>
            <div style={s.winTitle}><span>Listagem de Distancias</span><button onClick={()=>close('listagemDistanciasWin')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'6px'}}>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}>
                <label>Do concurso :</label>
                <input value={distParams.deAno} onChange={e=>setDistParams({...distParams,deAno:e.target.value})} style={{...s.field,width:'50px',backgroundColor:'#b0d0ff',textAlign:'center'}} />/<input value={distParams.deNum} onChange={e=>setDistParams({...distParams,deNum:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                <span style={{flex:1,backgroundColor:'#e8e8e8',border:'2px inset #fff',padding:'2px 6px'}}>{concursosLista.find(c=>c.num===distParams.deNum)?.nome || 'Cravinhos-Sp'}</span>
              </div>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}>
                <label>ao concurso :</label>
                <input value={distParams.ateAno} onChange={e=>setDistParams({...distParams,ateAno:e.target.value})} style={{...s.field,width:'50px',textAlign:'center'}} />/<input value={distParams.ateNum} onChange={e=>setDistParams({...distParams,ateNum:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                <span style={{flex:1,backgroundColor:'#e8e8e8',border:'2px inset #fff',padding:'2px 6px'}}>{concursosLista.find(c=>c.num===distParams.ateNum)?.nome || 'Brasilia-DF'}</span>
              </div>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}>
                <label>Do concorrente :</label>
                <input value={distParams.deConc1} onChange={e=>setDistParams({...distParams,deConc1:e.target.value})} style={{...s.field,width:'30px',textAlign:'center'}} /><input value={distParams.deConc2} onChange={e=>setDistParams({...distParams,deConc2:e.target.value})} style={{...s.field,width:'30px',textAlign:'center'}} /><input value={distParams.deConc3} onChange={e=>setDistParams({...distParams,deConc3:e.target.value})} style={{...s.field,width:'50px',textAlign:'center'}} />
                <button style={s.tbtn} onClick={()=>{setLupaTarget('distDe'); setLupaConcorrente(true);}} title="Pesquisar concorrente">🔍</button>
                <span style={{flex:1,backgroundColor:'#e8e8e8',border:'2px inset #fff',padding:'2px 6px',color:'#000080',fontWeight:'bold'}}>{distParams.deNome}</span>
              </div>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                <label>ao concorrente :</label>
                <input value={distParams.ateConc1} onChange={e=>setDistParams({...distParams,ateConc1:e.target.value})} style={{...s.field,width:'30px',textAlign:'center'}} /><input value={distParams.ateConc2} onChange={e=>setDistParams({...distParams,ateConc2:e.target.value})} style={{...s.field,width:'30px',textAlign:'center'}} /><input value={distParams.ateConc3} onChange={e=>setDistParams({...distParams,ateConc3:e.target.value})} style={{...s.field,width:'50px',textAlign:'center'}} />
                <button style={s.tbtn} onClick={()=>{setLupaTarget('distAte'); setLupaConcorrente(true);}} title="Pesquisar concorrente">🔍</button>
                <span style={{flex:1,backgroundColor:'#e8e8e8',border:'2px inset #fff',padding:'2px 6px',color:'#000080',fontWeight:'bold'}}>{distParams.ateNome}</span>
              </div>
              <div style={{display:'flex',gap:'12px',marginBottom:'4px'}}>
                <div style={{border:'1px solid #808080',padding:'4px',flex:1,textAlign:'center'}}>
                  <div style={{fontWeight:'bold',fontSize:'10px'}}>Tipo</div>
                  <label><input type="radio" checked={distParams.tipo==='Por concurso'} onChange={()=>setDistParams({...distParams,tipo:'Por concurso'})} /> Por concurso</label><label style={{marginLeft:'8px'}}><input type="radio" checked={distParams.tipo==='Por concorrente'} onChange={()=>setDistParams({...distParams,tipo:'Por concorrente'})} /> Por concorrente</label>
                </div>
                <div style={{border:'1px solid #808080',padding:'4px',flex:1,textAlign:'center'}}>
                  <div style={{fontWeight:'bold',fontSize:'10px'}}>Listagem</div>
                  <label><input type="radio" checked={distParams.listagem==='Corrida'} onChange={()=>setDistParams({...distParams,listagem:'Corrida'})} /> Corrida</label><label style={{marginLeft:'8px'}}><input type="radio" checked={distParams.listagem==='Com quebra'} onChange={()=>setDistParams({...distParams,listagem:'Com quebra'})} /> Com quebra</label>
                </div>
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'12px'}}>
                <button style={{...s.btn,minWidth:'90px'}} onClick={()=>open('listagemDistanciasPreview')}>Imprimir</button>
                <button style={{...s.btn,minWidth:'90px'}} onClick={()=>close('listagemDistanciasWin')}>Sair</button>
              </div>
            </div>
          </div>
        )}
        {wins.includes('listagemDistanciasPreview') && (
          <div style={{...s.win,width:'900px'}}>
            <div style={s.winTitle}><span>Print Preview - Listagem de Distancias</span><button onClick={()=>close('listagemDistanciasPreview')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,backgroundColor:'#fff',fontFamily:'Courier New, monospace',fontSize:'9px'}}>
              <div style={{display:'flex',gap:'4px',alignItems:'center',backgroundColor:'#c0c0c0',border:'1px solid #808080',padding:'3px 6px',margin:'-8px -8px 6px -8px'}}><button style={{...s.tbtn,padding:'1px 4px'}}>|&lt;&lt;</button><button style={{...s.tbtn,padding:'1px 4px'}}>&lt;</button><button style={{...s.tbtn,padding:'1px 4px'}}>&gt;</button><button style={{...s.tbtn,padding:'1px 4px'}}>&gt;&gt;|</button><select style={{...s.field,marginLeft:'8px'}}><option>100%</option></select><button style={s.tbtn}>Print</button></div>
              <div style={{textAlign:'center',fontWeight:'bold',color:'#008080'}}>CLUBE COLUMBOMFILO LIMEIRENSE</div>
              <div style={{textAlign:'center',fontWeight:'bold'}}>Listagem de Distancias por {distParams.tipo}</div>
              <div style={{fontSize:'9px',marginTop:'4px'}}>Do concurso {distParams.deAno}/{distParams.deNum} - {concursosLista.find(c=>c.num===distParams.deNum)?.nome} ao concurso {distParams.ateAno}/{distParams.ateNum} - {concursosLista.find(c=>c.num===distParams.ateNum)?.nome}<br/>Do concorrente {distParams.deConc1}/{distParams.deConc2}/{distParams.deConc3} - {distParams.deNome} ao {distParams.ateConc1}/{distParams.ateConc2}/{distParams.ateConc3} - {distParams.ateNome}</div>
              <div style={{backgroundColor:'#c0c0c0',padding:'2px 4px',marginTop:'4px',fontWeight:'bold'}}>Concurso {distParams.deAno}/{distParams.deNum} {concursosLista.find(c=>c.num===distParams.deNum)?.nome}</div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'9px'}}>
                <thead><tr style={{backgroundColor:'#c0c0c0'}}><th style={{border:'1px solid #000',padding:'2px'}}>Concorrente</th><th style={{border:'1px solid #000',padding:'2px'}}>Concurso<br/>Latitude Longitude</th><th style={{border:'1px solid #000',padding:'2px'}}>Concorrente<br/>Latitude Longitude</th><th style={{border:'1px solid #000',padding:'2px'}}>Distancia<br/>(metros)</th></tr></thead>
                <tbody>
                  {concorrentesLista.slice(0,8).map(cc=>{
                    const dist=calcDistancia(concursosLista.find(c=>c.num===distParams.deNum) || concurso, cc);
                    const concLatLon = (concursosLista.find(c=>c.num===distParams.deNum)?.latG||'021')+'-'+(concursosLista.find(c=>c.num===distParams.deNum)?.latM||'19')+'-'+(concursosLista.find(c=>c.num===distParams.deNum)?.latS||'45.0')+' '+(concursosLista.find(c=>c.num===distParams.deNum)?.lonG||'047')+'-'+(concursosLista.find(c=>c.num===distParams.deNum)?.lonM||'42')+'-'+(concursosLista.find(c=>c.num===distParams.deNum)?.lonS||'58.3');
                    return (<tr key={cc.num}><td style={{border:'1px solid #c0c0c0',padding:'1px 4px'}}>{cc.col}/ {cc.num} - {cc.nome}</td><td style={{border:'1px solid #c0c0c0',padding:'1px 4px',textAlign:'center'}}>{concLatLon}</td><td style={{border:'1px solid #c0c0c0',padding:'1px 4px',textAlign:'center'}}>{cc.lat} {cc.lon}</td><td style={{border:'1px solid #c0c0c0',padding:'1px 4px',textAlign:'right',fontWeight:'bold',backgroundColor:'#e8f0ff'}}>{dist.toFixed(1)}</td></tr>);
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* POMBOS ENVIADOS */}
        {wins.includes('pombosEnviadosWin') && (
          <div style={{...s.win,width:'560px'}}>
            <div style={s.winTitle}><span>Pombos Enviados</span><button onClick={()=>close('pombosEnviadosWin')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'6px'}}>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}>
                <label>Concurco :</label>
                <input value={pombosEnv.ano} onChange={e=>setPombosEnv({...pombosEnv,ano:e.target.value})} style={{...s.field,width:'50px',backgroundColor:'#b0d0ff',textAlign:'center',fontWeight:'bold'}} />/<input value={pombosEnv.num} onChange={e=>setPombosEnv({...pombosEnv,num:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                <button style={s.tbtn} onClick={()=>setLupaConcurso(true)}>Lupa</button>
                <span style={{flex:1,backgroundColor:'#e8e8e8',border:'2px inset #fff',padding:'2px 6px',color:'#000080'}}>{concursosLista.find(c=>c.num===pombosEnv.num)?.nome || 'Cravinhos-Sp'}</span>
              </div>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'8px'}}>
                <label>Assoc./Colec. :</label>
                <input value={pombosEnv.assoc} onChange={e=>setPombosEnv({...pombosEnv,assoc:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />/<input value={pombosEnv.colec} onChange={e=>setPombosEnv({...pombosEnv,colec:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                <button style={s.tbtn} onClick={()=>setMsg('Colectividades: 11/33 Federação Paulista')} title="Pesquisar colectividade">Lupa</button>
                <span style={{flex:1,backgroundColor:'#e8e8e8',border:'2px inset #fff',padding:'2px 6px',color:'#000080'}}>{pombosEnv.assocNome}</span>
              </div>
              <div style={{border:'2px groove #fff',padding:'8px',marginBottom:'6px'}}>
                <div style={{fontWeight:'bold',textAlign:'center',marginBottom:'8px'}}>Pombos</div>
                <div style={{display:'grid',gridTemplateColumns:'180px 80px',gap:'6px',justifyContent:'center',alignItems:'center'}}>
                  <label>Pombos Encestados :</label><input value={pombosEnv.encestados} onChange={e=>setPombosEnv({...pombosEnv,encestados:e.target.value.replace(/\D/g,'')})} style={{...s.field,width:'80px',textAlign:'center'}} />
                  <label>Enviados a Doublagem :</label><input value={pombosEnv.doublagem} onChange={e=>setPombosEnv({...pombosEnv,doublagem:e.target.value.replace(/\D/g,'')})} style={{...s.field,width:'80px',textAlign:'center'}} />
                  <label style={{fontWeight:'bold'}}>Total na Prova :</label><input value={pombosEnv.total} readOnly style={{...s.field,width:'80px',textAlign:'center',fontWeight:'bold',backgroundColor:'#e8e8e8'}} />
                </div>
              </div>
              <div style={{fontSize:'10px',backgroundColor:'#ffffe1',border:'1px solid #808080',padding:'4px 6px',marginBottom:'8px'}}>
                NOTA: Apenas os pombos encestados serao comunicados a Associacao.<br/>Os pombos enviados, no clube, sera a soma dos pombos encestados + doublagem.
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'6px'}}>
                <button style={s.btn} onClick={()=>{ const t=(parseInt(pombosEnv.encestados||0)+parseInt(pombosEnv.doublagem||0)); setPombosEnv({...pombosEnv,total:String(t)}); setMsg('Pombos Enviados atualizado: '+t); }}>Novo</button>
                <button style={{...s.btn,backgroundColor:'#c0ffc0'}} onClick={()=>{ const t=(parseInt(pombosEnv.encestados||0)+parseInt(pombosEnv.doublagem||0)); setPombosEnv({...pombosEnv,total:String(t)}); setMsg('Pombos Enviados guardado: Concurso '+pombosEnv.ano+'/'+pombosEnv.num+' Total '+t); close('pombosEnviadosWin'); }}>Guardar</button>
                <button style={s.btn}>Desfazer</button>
                <button style={{...s.btn,backgroundColor:'#ffc0c0'}} onClick={()=>setPombosEnv({ano:'2025',num:'1',assoc:'11',colec:'33',assocNome:'Federacao Paulista de Columbiofilia',encestados:'',doublagem:'',total:'0'})}>Anular</button>
                <button style={s.btn} onClick={()=>close('pombosEnviadosWin')}>Sair</button>
              </div>
            </div>
          </div>
        )}
        
        {/* ===== DADOS PROPRIOS ===== */}
        {wins.includes('dadosPropriosWin') && (
          <div style={{...s.win,width:'680px'}}>
            <div style={s.winTitle}><span>Dados Proprios</span><button onClick={()=>close('dadosPropriosWin')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'6px'}}>
              <div style={{display:'flex',gap:'12px'}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'90px'}}>Nome :</label><input value={dadosProprios.nome} onChange={e=>setDadosProprios({...dadosProprios,nome:e.target.value})} style={{...s.field,flex:1,backgroundColor:'#fff',fontWeight:'bold'}} /></div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'90px'}}>Morada :</label><input value={dadosProprios.morada} onChange={e=>setDadosProprios({...dadosProprios,morada:e.target.value})} style={{...s.field,flex:1}} /></div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'90px'}}>Localidade :</label><input value={dadosProprios.localidade} onChange={e=>setDadosProprios({...dadosProprios,localidade:e.target.value})} style={{...s.field,flex:1}} /></div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'90px'}}>Codigo Postal :</label><input value={dadosProprios.cod1} onChange={e=>setDadosProprios({...dadosProprios,cod1:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} /><input value={dadosProprios.cod2} onChange={e=>setDadosProprios({...dadosProprios,cod2:e.target.value})} style={{...s.field,flex:1}} /></div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'90px'}}>Telefone :</label><input value={dadosProprios.telefone} onChange={e=>setDadosProprios({...dadosProprios,telefone:e.target.value})} style={{...s.field,flex:1}} /><label style={{marginLeft:'8px'}}>Fax :</label><input value={dadosProprios.fax} onChange={e=>setDadosProprios({...dadosProprios,fax:e.target.value})} style={{...s.field,flex:1}} /></div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center'}}><label style={{width:'90px'}}>Email :</label><input value={dadosProprios.email} onChange={e=>setDadosProprios({...dadosProprios,email:e.target.value})} style={{...s.field,flex:1}} /></div>
                </div>
                <div style={{width:'180px',border:'1px solid #808080',padding:'6px',backgroundColor:'#d4d0c8',textAlign:'center'}}>
                  <div style={{fontWeight:'bold',fontSize:'10px'}}>Logotipo</div>
                  <div style={{width:'160px',height:'100px',border:'2px inset #fff',backgroundColor:'#fff',margin:'6px auto',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',color:'#808080'}}>Sem imagem</div>
                  <button style={s.btn}>Seleccionar</button>
                  <div style={{marginTop:'8px',fontSize:'10px'}}>Imprime Logo? <label><input type="radio" checked={dadosProprios.imprimeLogo==='Sim'} onChange={()=>setDadosProprios({...dadosProprios,imprimeLogo:'Sim'})} /> Sim</label> <label><input type="radio" checked={dadosProprios.imprimeLogo==='Não'} onChange={()=>setDadosProprios({...dadosProprios,imprimeLogo:'Não'})} /> Não</label></div>
                </div>
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'12px',marginTop:'8px'}}>
                <button style={{...s.btn,backgroundColor:'#c0ffc0'}} onClick={()=>{setMsg('Dados Proprios guardados: '+dadosProprios.nome); close('dadosPropriosWin');}}>Guardar</button>
                <button style={s.btn}>Destazer</button>
                <button style={s.btn} onClick={()=>close('dadosPropriosWin')}>Sair</button>
              </div>
            </div>
          </div>
        )}
        {/* CONFIGURACAO 1 */}
        {wins.includes('configWin') && (
          <div style={{...s.win,width:'820px'}}>
            <div style={s.winTitle}><span>Configuracao da Aplicacao</span><button onClick={()=>close('configWin')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'6px',fontSize:'10px'}}>
              <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'4px',flexWrap:'wrap'}}>
                <label>N pombos Equipias Variaveis :</label><input value={config.numEquipas} onChange={e=>setConfig({...config,numEquipas:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                <label>Equipas Virtuais ?</label><label><input type="radio" checked={config.equipasVirt==='Não'} onChange={()=>setConfig({...config,equipasVirt:'Não'})} /> Não</label><label><input type="radio" checked={config.equipasVirt==='Sim'} onChange={()=>setConfig({...config,equipasVirt:'Sim'})} /> Sim</label>
                <label>Pede sexo?</label><label><input type="radio" checked={config.pedeSexo==='Não'} onChange={()=>setConfig({...config,pedeSexo:'Não'})} /> Não</label><label><input type="radio" checked={config.pedeSexo==='Sim'} onChange={()=>setConfig({...config,pedeSexo:'Sim'})} /> Sim</label>
              </div>
              <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'4px',flexWrap:'wrap'}}>
                <label>Tipo Coordenadas:</label><label><input type="radio" checked={config.tipoCoord==='Cartográfica'} onChange={()=>setConfig({...config,tipoCoord:'Cartográfica'})} /> Cartografica</label><label><input type="radio" checked={config.tipoCoord==='Geográficas'} onChange={()=>setConfig({...config,tipoCoord:'Geográficas'})} /> Geograficas</label>
                <label>Pombos designados separados ?</label><label><input type="radio" checked={config.pombosSep==='Não'} onChange={()=>setConfig({...config,pombosSep:'Não'})} /> Não</label><label><input type="radio" checked={config.pombosSep==='Sim'} onChange={()=>setConfig({...config,pombosSep:'Sim'})} /> Sim</label>
              </div>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px',flexWrap:'wrap'}}>
                <label>Entidade :</label><label><input type="radio" checked={config.entidade==='Federação'} onChange={()=>setConfig({...config,entidade:'Federação'})} /> Federacao</label><label><input type="radio" checked={config.entidade==='Associação'} onChange={()=>setConfig({...config,entidade:'Associação'})} /> Associacao</label><label><input type="radio" checked={config.entidade==='Colectividade'} onChange={()=>setConfig({...config,entidade:'Colectividade'})} /> Colectividade</label><label><input type="radio" checked={config.entidade==='Grupo de Fundo'} onChange={()=>setConfig({...config,entidade:'Grupo de Fundo'})} /> Grupo de Fundo</label>
                <label>Utiliza Zonas ?</label><label><input type="radio" checked={config.zonas==='Não'} onChange={()=>setConfig({...config,zonas:'Não'})} /> Não</label><label><input type="radio" checked={config.zonas==='Sim'} onChange={()=>setConfig({...config,zonas:'Sim'})} /> Sim</label>
              </div>
              <div style={{border:'1px solid #808080',padding:'4px',marginBottom:'4px',backgroundColor:'#d4d0c8'}}>
                <div style={{fontWeight:'bold',textAlign:'center'}}>4 Campeonato</div>
                <div style={{display:'flex',gap:'8px',alignItems:'center',marginTop:'4px',flexWrap:'wrap'}}>
                  <label>Activo ?</label><label><input type="radio" checked={config.quartoAtivo==='Não'} onChange={()=>setConfig({...config,quartoAtivo:'Não'})} /> Não</label><label><input type="radio" checked={config.quartoAtivo==='Sim'} onChange={()=>setConfig({...config,quartoAtivo:'Sim'})} /> Sim</label>
                  <label>Quantos Pontuam ?</label><input value={config.quantosPontuam} onChange={e=>setConfig({...config,quantosPontuam:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                  <label>Ordem de Movim.:</label><label><input type="radio" checked={config.ordemMov==='Hora'} onChange={()=>setConfig({...config,ordemMov:'Hora'})} /> Hora</label><label><input type="radio" checked={config.ordemMov==='Lançamento'} onChange={()=>setConfig({...config,ordemMov:'Lançamento'})} /> Lancamento</label><label><input type="radio" checked={config.ordemMov==='Anilha'} onChange={()=>setConfig({...config,ordemMov:'Anilha'})} /> Anilha</label>
                </div>
                <div style={{display:'flex',gap:'6px',alignItems:'center',marginTop:'4px'}}><label>Nome de campeonato :</label><input value={config.nomeCamp} onChange={e=>setConfig({...config,nomeCamp:e.target.value})} style={{...s.field,flex:1}} /></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginBottom:'4px'}}>
                <div style={{border:'1px solid #808080',padding:'4px'}}>
                  <div style={{fontWeight:'bold',textAlign:'center',fontSize:'10px'}}>Calculo de Intercolectividades</div>
                  <label><input type="radio" checked={config.calcInter==='Por melhores Pombos Geral'} onChange={()=>setConfig({...config,calcInter:'Por melhores Pombos Geral'})} /> Por melhores Pombos Geral</label><br/>
                  <label><input type="radio" checked={config.calcInter==='Por melhores Pombos Designados'} onChange={()=>setConfig({...config,calcInter:'Por melhores Pombos Designados'})} /> Por melhores Pombos Designados</label><br/>
                  <label><input type="radio" checked={config.calcInter==='Por melhores Concorrentes'} onChange={()=>setConfig({...config,calcInter:'Por melhores Concorrentes'})} /> Por melhores Concorrentes</label><br/>
                  <label><input type="radio" checked={config.calcInter==='Por percentagem'} onChange={()=>setConfig({...config,calcInter:'Por percentagem'})} /> Por percentagem</label>
                  <div style={{marginTop:'4px'}}>N ocorrencias para método selecionado : <input value={config.numOcor} onChange={e=>setConfig({...config,numOcor:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} /></div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                  <div style={{border:'1px solid #808080',padding:'4px'}}>
                    <div style={{fontWeight:'bold',textAlign:'center',fontSize:'10px'}}>Premios Monetarios</div>
                    <label>Premios para pombos : <label><input type="radio" checked={config.premiosTodos} onChange={()=>setConfig({...config,premiosTodos:true})} /> Todos</label> <label><input type="radio" checked={!config.premiosTodos} onChange={()=>setConfig({...config,premiosTodos:false})} /> Designados</label></label><br/>
                    <label>Percentagem dos pombos enviados : <input value={config.percEnv} onChange={e=>setConfig({...config,percEnv:e.target.value})} style={{...s.field,width:'50px',textAlign:'center'}} /></label><br/>
                    <label>Premios ate ao lugar : <input value={config.premiosAte} onChange={e=>setConfig({...config,premiosAte:e.target.value})} style={{...s.field,width:'60px',textAlign:'center'}} /></label><br/>
                    <label>Para pombos com 0 pontos? <label><input type="radio" checked={config.comZero==='Não'} onChange={()=>setConfig({...config,comZero:'Não'})} /> Não</label> <label><input type="radio" checked={config.comZero==='Sim'} onChange={()=>setConfig({...config,comZero:'Sim'})} /> Sim</label></label>
                  </div>
                  <div style={{border:'1px solid #808080',padding:'4px'}}>
                    <div style={{fontWeight:'bold',textAlign:'center',fontSize:'10px'}}>Campeonato de Borrachos</div>
                    <label>Tipo de classificacao : <label><input type="radio" checked={config.borraTipo==='Geral'} onChange={()=>setConfig({...config,borraTipo:'Geral'})} /> Geral</label> <label><input type="radio" checked={config.borraTipo==='Própria'} onChange={()=>setConfig({...config,borraTipo:'Própria'})} /> Propria</label></label><br/>
                    <label>Quantos pontuam ? : <input value={config.borraQuantos} onChange={e=>setConfig({...config,borraQuantos:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} /></label>
                  </div>
                </div>
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'8px'}}>
                <button style={s.btn} onClick={()=>{setMsg('Configuracao guardada'); close('configWin');}}>Guardar</button>
                <button style={s.btn}>Desfazer</button>
                <button style={s.btn} onClick={()=>close('configWin')}>Sair</button>
              </div>
            </div>
          </div>
        )}
        {wins.includes('config2Win') && (
          <div style={{...s.win,width:'640px'}}>
            <div style={s.winTitle}><span>Configuracao da Aplicacao 2</span><button onClick={()=>close('config2Win')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'8px',fontSize:'11px'}}>
              <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'12px'}}>
                <label>Quantos pontos pontuam para o columbofilo :</label><input value={config2.pontuaColumbo} onChange={e=>setConfig2({...config2,pontuaColumbo:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
              </div>
              <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'8px'}}>
                <label>Descritivo de moeda :</label><input value={config2.moeda} onChange={e=>setConfig2({...config2,moeda:e.target.value})} style={{...s.field,width:'80px',textAlign:'center'}} />
                <label>N pombos para campeonato Columbonfilo (Federacao):</label><input value={config2.numPombosCol} onChange={e=>setConfig2({...config2,numPombosCol:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
              </div>
              <div style={{display:'flex',gap:'12px',alignItems:'center',marginBottom:'8px'}}>
                <label>Todos os pombos para campeonato Columbonfilo (Federacao):</label><label><input type="radio" checked={config2.todosPombos==='Não'} onChange={()=>setConfig2({...config2,todosPombos:'Não'})} /> Não</label><label><input type="radio" checked={config2.todosPombos==='Sim'} onChange={()=>setConfig2({...config2,todosPombos:'Sim'})} /> Sim</label>
              </div>
              <div style={{border:'1px solid #808080',padding:'6px',display:'inline-block'}}>
                <label>Sinalizacao de pombos enviados:</label><label style={{marginLeft:'8px'}}><input type="radio" checked={config2.sinalPor==='Por Concorrente'} onChange={()=>setConfig2({...config2,sinalPor:'Por Concorrente'})} /> Por Concorrente</label><label><input type="radio" checked={config2.sinalPor==='Por Prova'} onChange={()=>setConfig2({...config2,sinalPor:'Por Prova'})} /> Por Prova</label>
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'12px',marginTop:'16px'}}>
                <button style={s.btn} onClick={()=>{setMsg('Configuracao 2 guardada'); close('config2Win');}}>Guardar</button>
                <button style={s.btn}>Desfazer</button>
                <button style={s.btn} onClick={()=>close('config2Win')}>Sair</button>
              </div>
            </div>
          </div>
        )}
        
        {/* TABELA DE LOCAIS DE SOLTA */}
        {wins.includes('locaisSoltaWin') && (
          <div style={{...s.win,width:'720px'}}>
            <div style={s.winTitle}><span>Tabela de Locais de Solta</span><button onClick={()=>close('locaisSoltaWin')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'0'}}>
              <div style={{display:'flex',backgroundColor:'#c0c0c0',borderBottom:'1px solid #808080'}}>
                {['Editar','Consultar'].map(tab=> (
                  <button key={tab} onClick={()=>setLocaisTab(tab)} style={{padding:'4px 16px',border:'1px solid #808080',backgroundColor: locaisTab===tab ? '#c0c0c0' : '#a0a0a0',fontWeight: locaisTab===tab ? 'bold':'normal'}}>{tab}</button>
                ))}
              </div>
              {locaisTab==='Editar' && (
                <div style={{padding:'8px'}}>
                  <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'6px'}}>
                    <label>Codigo de Local :</label><input value={localEdit.codigo} onChange={e=>setLocalEdit({...localEdit,codigo:e.target.value})} style={{...s.field,width:'50px',backgroundColor:'#b0d0ff',textAlign:'center',fontWeight:'bold'}} />
                  </div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                    <label style={{width:'100px'}}>Nome de Local :</label><input value={localEdit.nome} onChange={e=>setLocalEdit({...localEdit,nome:e.target.value})} style={{...s.field,flex:1}} />
                  </div>
                  <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'6px'}}>
                    <label>Imprime :</label><label><input type="radio" checked={localEdit.imprime==='Não'} onChange={()=>setLocalEdit({...localEdit,imprime:'Não'})} /> Não</label><label><input type="radio" checked={localEdit.imprime==='Sim'} onChange={()=>setLocalEdit({...localEdit,imprime:'Sim'})} /> Sim</label>
                  </div>
                  <div style={{border:'1px solid #808080',padding:'6px',marginBottom:'8px'}}>
                    <div style={{fontWeight:'bold',textAlign:'center',fontSize:'11px'}}>Coordenadas</div>
                    <div style={{display:'flex',gap:'8px',justifyContent:'center',marginTop:'4px',alignItems:'center'}}>
                      <label>Latitude :</label><input value={localEdit.latG} onChange={e=>setLocalEdit({...localEdit,latG:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} /><input value={localEdit.latM} onChange={e=>setLocalEdit({...localEdit,latM:e.target.value})} style={{...s.field,width:'30px',textAlign:'center'}} /><input value={localEdit.latS} onChange={e=>setLocalEdit({...localEdit,latS:e.target.value})} style={{...s.field,width:'50px',textAlign:'center'}} />
                      <label>Longitude :</label><input value={localEdit.lonG} onChange={e=>setLocalEdit({...localEdit,lonG:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} /><input value={localEdit.lonM} onChange={e=>setLocalEdit({...localEdit,lonM:e.target.value})} style={{...s.field,width:'30px',textAlign:'center'}} /><input value={localEdit.lonS} onChange={e=>setLocalEdit({...localEdit,lonS:e.target.value})} style={{...s.field,width:'50px',textAlign:'center'}} />
                    </div>
                  </div>
                  <div style={{display:'flex',justifyContent:'center',gap:'6px'}}>
                    <button style={s.btn}>Novo</button><button style={{...s.btn,backgroundColor:'#c0ffc0'}} onClick={()=>{setMsg('Local '+localEdit.codigo+' guardado'); setLocaisTab('Consultar');}}>Guardar</button><button style={s.btn}>Desfazer</button><button style={{...s.btn,backgroundColor:'#ffc0c0'}}>Anular</button><button style={s.btn} onClick={()=>open('listagemDistanciasWin')}>Imprimir</button><button style={s.btn} onClick={()=>close('locaisSoltaWin')}>Sair</button>
                  </div>
                </div>
              )}
              {locaisTab==='Consultar' && (
                <div style={{padding:'8px'}}>
                  <div style={{border:'2px inset #fff',backgroundColor:'#fff',height:'260px',overflowY:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px'}}>
                      <thead><tr style={{backgroundColor:'#000080',color:'#fff'}}><th style={{border:'1px solid #808080',padding:'3px'}}>Codigo</th><th style={{border:'1px solid #808080',padding:'3px'}}>Nome</th><th style={{border:'1px solid #808080',padding:'3px'}}>Imprimir</th></tr></thead>
                      <tbody>{locaisLista.map(l=> (<tr key={l.codigo} onClick={()=>{setLocalEdit({codigo:l.codigo,nome:l.nome,imprime:l.imprime,latG:'021',latM:'19',latS:'45.0',lonG:'047',lonM:'42',lonS:'58.3'}); setLocaisTab('Editar');}} style={{cursor:'pointer'}}><td style={{border:'1px solid #c0c0c0',padding:'2px 6px',textAlign:'center'}}>{l.codigo}</td><td style={{border:'1px solid #c0c0c0',padding:'2px 6px'}}>{l.nome}</td><td style={{border:'1px solid #c0c0c0',padding:'2px 6px',textAlign:'center'}}>{l.imprime}</td></tr>))}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* TABELA DE HORAS MORTAS */}
        {wins.includes('horasMortasWin') && (
          <div style={{...s.win,width:'520px'}}>
            <div style={s.winTitle}><span>Tabela de Horas Mortas</span><button onClick={()=>close('horasMortasWin')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'6px'}}>
              <div style={{display:'flex',backgroundColor:'#c0c0c0',borderBottom:'1px solid #808080',margin:'-6px -6px 8px -6px',padding:'4px 8px'}}>
                <button style={{padding:'3px 12px',border:'1px inset #fff',backgroundColor:'#c0c0c0',fontWeight:'bold'}}>Editar</button><button style={{padding:'3px 12px',border:'1px solid #808080',backgroundColor:'#a0a0a0'}} onClick={()=>setMsg('Consultar Horas Mortas')}>Consultar</button>
              </div>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                <label>Data :</label><input value={horaMorta.data} onChange={e=>setHoraMorta({...horaMorta,data:e.target.value})} placeholder="  /  /" style={{...s.field,width:'80px'}} />
              </div>
              <div style={{display:'flex',gap:'12px',marginBottom:'6px',flexWrap:'wrap'}}>
                <label>Tempo Morto de noite seguinte :</label><input value={horaMorta.tempoMorto} onChange={e=>setHoraMorta({...horaMorta,tempoMorto:e.target.value})} placeholder="  :  " style={{...s.field,width:'70px',textAlign:'center'}} />
                <label>Hora inicio :</label><input value={horaMorta.horaInicio} onChange={e=>setHoraMorta({...horaMorta,horaInicio:e.target.value})} placeholder="  :  " style={{...s.field,width:'70px',textAlign:'center'}} />
                <label>Hora fim :</label><input value={horaMorta.horaFim} onChange={e=>setHoraMorta({...horaMorta,horaFim:e.target.value})} placeholder="  :  " style={{...s.field,width:'70px',textAlign:'center'}} />
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'6px',marginTop:'12px'}}>
                <button style={s.btn}>Novo</button><button style={{...s.btn,backgroundColor:'#c0ffc0'}} onClick={()=>setMsg('Hora Morta guardada '+horaMorta.data)}>Guardar</button><button style={s.btn}>Desfazer</button><button style={{...s.btn,backgroundColor:'#ffc0c0'}}>Anular</button><button style={s.btn}>Imprimir</button><button style={s.btn} onClick={()=>close('horasMortasWin')}>Sair</button>
              </div>
            </div>
          </div>
        )}
        {/* PONTOS E PERCENTAGENS */}
        {wins.includes('pontosPercWin') && (
          <div style={{...s.win,width:'540px'}}>
            <div style={s.winTitle}><span>Pontos e Percentagens</span><button onClick={()=>close('pontosPercWin')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'8px'}}>
              <div style={{border:'1px solid #808080',padding:'6px',marginBottom:'8px',backgroundColor:'#d4d0c8'}}>
                <label>Tipo de Prova :</label>
                {['Velocidade','Meio Fundo','Fundo','Grande Fundo'].map(t=> <label key={t} style={{marginLeft:'8px'}}><input type="radio" checked={pontosPerc.tipo===t} onChange={()=>setPontosPerc({...pontosPerc,tipo:t})} /> {t}</label>)}
              </div>
              <div style={{border:'2px groove #fff',padding:'8px',textAlign:'center'}}>
                <div style={{fontWeight:'bold'}}>GERAL</div>
                <div style={{display:'flex',gap:'12px',justifyContent:'center',marginTop:'8px',alignItems:'center'}}>
                  <label>Pontos para 1 Pombo :</label><input value={pontosPerc.pontos1} onChange={e=>setPontosPerc({...pontosPerc,pontos1:e.target.value})} style={{...s.field,width:'50px',textAlign:'center'}} />
                </div>
                <div style={{display:'flex',gap:'12px',justifyContent:'center',marginTop:'6px',alignItems:'center'}}>
                  <label>% Pombos :</label><input value={pontosPerc.percPombos} onChange={e=>setPontosPerc({...pontosPerc,percPombos:e.target.value})} style={{...s.field,width:'50px',textAlign:'center'}} />
                </div>
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'8px',marginTop:'12px'}}>
                <button style={{...s.btn,backgroundColor:'#c0ffc0'}} onClick={()=>{setMsg('Pontos '+pontosPerc.tipo+' guardado: '+pontosPerc.pontos1+' pts'); close('pontosPercWin');}}>Guardar</button>
                <button style={s.btn}>Desfazer</button>
                <button style={{...s.btn,backgroundColor:'#ffc0c0'}}>Anular</button>
                <button style={s.btn} onClick={()=>close('pontosPercWin')}>Sair</button>
              </div>
            </div>
          </div>
        )}
        
        {/* ===== UTILITARIOS - COPIA DE SEGURANCA ===== */}
        {wins.includes('backupTotalWin') && (
          <div style={{...s.win,width:'520px'}}>
            <div style={s.winTitle}><span>Cópia de Segurança Total</span><button onClick={()=>close('backupTotalWin')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'8px',textAlign:'center'}}>
              <div style={{color:'#000080',fontWeight:'bold',fontSize:'11px'}}>ATENÇÃO : Vai executar cópia de segurança.</div>
              <div style={{color:'#000080',fontWeight:'bold',fontSize:'11px',marginBottom:'12px'}}>No fim do processo a aplicação é encerrada.</div>
              <div style={{display:'flex',gap:'8px',alignItems:'center',justifyContent:'center',marginBottom:'12px'}}>
                <label>Destino :</label><label><input type="radio" checked={backup.destino==='Disquete'} onChange={()=>setBackup({...backup,destino:'Disquete'})} /> Disquete</label><label><input type="radio" checked={backup.destino==='Outra Localização'} onChange={()=>setBackup({...backup,destino:'Outra Localização'})} /> Outra Localização</label>
                <label>Localização :</label><input value={backup.loc} onChange={e=>setBackup({...backup,loc:e.target.value})} style={{...s.field,flex:1}} />
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'12px'}}>
                <button style={{...s.btn,minWidth:'90px'}} onClick={()=>{ const blob=new Blob(['BACKUP TOTAL '+new Date().toLocaleString()],{type:'text/plain'}); const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download='BACKUP_TOTAL_'+concurso.ano+'.zip'; a.click(); URL.revokeObjectURL(u); setMsg('Cópia de Segurança Total concluída - Disquete'); close('backupTotalWin'); }}>Segurança</button>
                <button style={{...s.btn,minWidth:'90px'}} onClick={()=>close('backupTotalWin')}>Sair</button>
              </div>
            </div>
          </div>
        )}
        {wins.includes('backupDadosWin') && (
          <div style={{...s.win,width:'520px'}}>
            <div style={s.winTitle}><span>Cópia de Segurança de Dados</span><button onClick={()=>close('backupDadosWin')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'8px',textAlign:'center'}}>
              <div style={{color:'#000080',fontWeight:'bold'}}>ATENÇÃO : Vai executar cópia de segurança de dados.</div>
              <div style={{color:'#000080',fontWeight:'bold',marginBottom:'12px'}}>No fim do processo a aplicação é encerrada.</div>
              <div style={{display:'flex',gap:'8px',alignItems:'center',justifyContent:'center',marginBottom:'12px'}}>
                <label>Destino :</label><label><input type="radio" checked={backup.destino==='Disquete'} onChange={()=>setBackup({...backup,destino:'Disquete'})} /> Disquete</label><label><input type="radio" checked={backup.destino==='Outra Localização'} onChange={()=>setBackup({...backup,destino:'Outra Localização'})} /> Outra Localização</label>
                <label>Localização :</label><input value={backup.loc} onChange={e=>setBackup({...backup,loc:e.target.value})} style={{...s.field,flex:1}} />
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'12px'}}>
                <button style={{...s.btn,minWidth:'90px'}} onClick={()=>{ setMsg('Cópia de Dados concluída'); close('backupDadosWin'); }}>Segurança</button>
                <button style={{...s.btn,minWidth:'90px'}} onClick={()=>close('backupDadosWin')}>Sair</button>
              </div>
            </div>
          </div>
        )}
        {wins.includes('reposicaoWin') && (
          <div style={{...s.win,width:'560px'}}>
            <div style={s.winTitle}><span>Reposição de Cópias</span><button onClick={()=>close('reposicaoWin')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'8px',textAlign:'center'}}>
              <div style={{color:'#800000',fontWeight:'bold'}}>ATENÇÃO : Vai repor cópia de segurança.</div>
              <div style={{fontWeight:'bold',marginBottom:'4px'}}>Esta reposição vai sobrepor toda a informação da aplicação.</div>
              <div style={{color:'#000080',fontWeight:'bold',marginBottom:'12px'}}>No fim do processo a aplicação é encerrada.</div>
              <div style={{display:'flex',gap:'8px',alignItems:'center',justifyContent:'center',marginBottom:'12px'}}>
                <label>Destino :</label><label><input type="radio" checked={backup.destino==='Disquete'} onChange={()=>setBackup({...backup,destino:'Disquete'})} /> Disquete</label><label><input type="radio" checked={backup.destino==='Outra Localização'} onChange={()=>setBackup({...backup,destino:'Outra Localização'})} /> Outra Localização</label>
                <label>Localização :</label><input value={backup.loc} onChange={e=>setBackup({...backup,loc:e.target.value})} style={{...s.field,flex:1}} />
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'12px'}}>
                <button style={{...s.btn,minWidth:'90px',backgroundColor:'#ffc0c0'}} onClick={()=>{ if(confirm('ATENÇÃO: Vai sobrepor toda a informação. Continuar?')){ setMsg('Reposição concluída'); close('reposicaoWin'); }}}>Reposição</button>
                <button style={{...s.btn,minWidth:'90px'}} onClick={()=>close('reposicaoWin')}>Sair</button>
              </div>
            </div>
          </div>
        )}
        {/* APAGAR CALCULO / CLASSIFICACOES */}
        {wins.includes('apagarCalculoWin') && (
          <div style={{...s.win,width:'520px'}}>
            <div style={s.winTitle}><span>Apagar Cálculo de Prova</span><button onClick={()=>close('apagarCalculoWin')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'6px'}}>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                <label>Do concurso :</label>
                <input value={concurso.ano} onChange={e=>setConcurso({...concurso,ano:e.target.value})} style={{...s.field,width:'50px',backgroundColor:'#b0d0ff',textAlign:'center',fontWeight:'bold'}} />/<input value={concurso.num} onChange={e=>setConcurso({...concurso,num:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                <button style={s.tbtn} onClick={()=>setLupaConcurso(true)}>🔍</button>
                <input value={concurso.nome} readOnly style={{...s.field,flex:1,backgroundColor:'#e8e8e8'}} />
              </div>
              <div style={{border:'1px solid #808080',padding:'6px',marginBottom:'6px'}}>
                <div style={{fontWeight:'bold',textAlign:'center',fontSize:'10px'}}>Dados do Concurso</div>
                <div style={{display:'grid',gridTemplateColumns:'70px 100px 70px 100px',gap:'6px',marginTop:'4px'}}>
                  <label>Tipo :</label><input value={concurso.tipo} readOnly style={{...s.field,backgroundColor:'#ffd0d0',textAlign:'center'}} />
                  <label>Latitude :</label><input value={concurso.lat} readOnly style={{...s.field,backgroundColor:'#e8e8e8'}} />
                  <label>Data :</label><input value={concurso.data} readOnly style={{...s.field,backgroundColor:'#e8e8e8'}} />
                  <label>Longitude :</label><input value={concurso.lon} readOnly style={{...s.field,backgroundColor:'#e8e8e8'}} />
                </div>
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'12px'}}>
                <button style={{...s.btn,backgroundColor:'#ffc0c0'}} onClick={()=>{ if(confirm('Apagar cálculo da prova '+concurso.ano+'/'+concurso.num+' ?')){ apagarCalculo(); close('apagarCalculoWin'); setMsg('Cálculo apagado'); }}}>Confirmar</button>
                <button style={s.btn} onClick={()=>close('apagarCalculoWin')}>Sair</button>
              </div>
              <div style={{position:'relative',marginTop:'8px',border:'2px inset #fff',backgroundColor:'#fff',height:'120px',overflowY:'auto'}}>
                <div style={{backgroundColor:'#000080',color:'#fff',padding:'2px 6px',fontSize:'10px',fontWeight:'bold'}}>Visualização de tabela de Concursos</div>
                <table style={{width:'100%',fontSize:'10px',borderCollapse:'collapse'}}>
                  <thead><tr style={{backgroundColor:'#c0c0c0'}}><th style={{border:'1px solid #808080'}}>Ano</th><th style={{border:'1px solid #808080'}}>Numero</th><th style={{border:'1px solid #808080'}}>Nome</th><th style={{border:'1px solid #808080'}}>T</th></tr></thead>
                  <tbody>{concursosLista.slice(0,7).map(c=> (<tr key={c.num} onClick={()=>{setConcurso({ano:c.ano,num:c.num,nome:c.nome,tipo:c.tipo,data:c.data,lat:'015-42-01.1',lon:'047-48-39.0',enviados:300,tempoMorto:'10:52:00',horaSolta:'06:35:00'}); setMsg('Concurso '+c.ano+'/'+c.num+' selecionado');}} style={{cursor:'pointer'}}><td style={{border:'1px solid #c0c0c0',textAlign:'center'}}>{c.ano}</td><td style={{border:'1px solid #c0c0c0',textAlign:'center'}}>{c.num}</td><td style={{border:'1px solid #c0c0c0',padding:'1px 4px'}}>{c.nome}</td><td style={{border:'1px solid #c0c0c0',textAlign:'center'}}>{c.tipo==='Fundo'?'F':'G'}</td></tr>))}</tbody>
                </table>
                <div style={{display:'flex',justifyContent:'center',gap:'8px',marginTop:'4px'}}><button style={s.btn} onClick={()=>setMsg('Concurso confirmado para apagar')}>Confirmar</button><button style={s.btn}>Sair</button></div>
              </div>
            </div>
          </div>
        )}
        {wins.includes('apagarClassWin') && (
          <div style={{...s.win,width:'520px'}}>
            <div style={s.winTitle}><span>Apagar Classificações de Prova</span><button onClick={()=>close('apagarClassWin')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'6px',textAlign:'center'}}>
              <div style={{color:'#800000',fontWeight:'bold'}}>ATENÇÃO: Esta opção apaga definitivamente classificações da prova indicada.</div>
              <div style={{color:'#000080',fontWeight:'bold',marginBottom:'8px'}}>Recomenda-se que efectue cópia de segurança dos dados.</div>
              <div style={{display:'flex',gap:'6px',alignItems:'center',justifyContent:'center',marginBottom:'6px'}}>
                <label>Do concurso :</label>
                <input value={concurso.ano} onChange={e=>setConcurso({...concurso,ano:e.target.value})} style={{...s.field,width:'50px',backgroundColor:'#b0d0ff',textAlign:'center'}} />/<input value={concurso.num} onChange={e=>setConcurso({...concurso,num:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                <button style={s.tbtn} onClick={()=>setLupaConcurso(true)}>🔍</button>
                <input value={concurso.nome} readOnly style={{...s.field,flex:1}} />
              </div>
              <div style={{border:'1px solid #808080',padding:'6px',marginBottom:'8px'}}>
                <div style={{fontWeight:'bold',textAlign:'center',fontSize:'10px'}}>Dados do Concurso</div>
                <div style={{display:'grid',gridTemplateColumns:'70px 100px 70px 100px',gap:'6px',marginTop:'4px'}}>
                  <label>Tipo :</label><input value={concurso.tipo} readOnly style={{...s.field,backgroundColor:'#ffd0d0',textAlign:'center'}} />
                  <label>Latitude :</label><input value={concurso.lat} readOnly style={{...s.field,backgroundColor:'#e8e8e8'}} />
                  <label>Data :</label><input value={concurso.data} readOnly style={{...s.field,backgroundColor:'#e8e8e8'}} />
                  <label>Longitude :</label><input value={concurso.lon} readOnly style={{...s.field,backgroundColor:'#e8e8e8'}} />
                </div>
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'12px'}}>
                <button style={{...s.btn,backgroundColor:'#ffc0c0'}} onClick={()=>{ if(confirm('Apagar classificações '+concurso.ano+'/'+concurso.num+'?')){ setMsg('Classificações apagadas'); close('apagarClassWin'); }}}>Confirmar</button>
                <button style={s.btn} onClick={()=>close('apagarClassWin')}>Sair</button>
              </div>
              <div style={{marginTop:'8px',border:'2px inset #fff',backgroundColor:'#fff',height:'100px',overflowY:'auto'}}>
                <div style={{backgroundColor:'#000080',color:'#fff',padding:'2px 6px',fontSize:'10px'}}>Visualização de tabela de Concursos</div>
                <div style={{padding:'4px',fontSize:'10px',textAlign:'left'}}>{concursosLista.slice(0,7).map(c=> (<div key={c.num} onClick={()=>setConcurso({...concurso,ano:c.ano,num:c.num,nome:c.nome,tipo:c.tipo,data:c.data,lat:'015-42-01.1',lon:'047-48-39.0',enviados:300})} style={{cursor:'pointer',padding:'1px 4px'}}>{c.ano} {c.num} {c.nome} {c.tipo[0]}</div>))}</div>
              </div>
            </div>
          </div>
        )}
        {wins.includes('apagarClassConcWin') && (
          <div style={{...s.win,width:'560px'}}>
            <div style={s.winTitle}><span>Apagar Classificações de Concorrente na Prova</span><button onClick={()=>close('apagarClassConcWin')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'6px'}}>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                <label>Do concurso :</label>
                <input value={concurso.ano} onChange={e=>setConcurso({...concurso,ano:e.target.value})} style={{...s.field,width:'50px',backgroundColor:'#b0d0ff',textAlign:'center'}} />/<input value={concurso.num} onChange={e=>setConcurso({...concurso,num:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                <button style={s.tbtn} onClick={()=>setLupaConcurso(true)}>🔍</button>
                <input value={concurso.nome} readOnly style={{...s.field,flex:1}} />
              </div>
              <div style={{border:'1px solid #808080',padding:'6px',marginBottom:'6px'}}>
                <div style={{fontWeight:'bold',textAlign:'center',fontSize:'10px'}}>Dados do Concurso</div>
                <div style={{display:'grid',gridTemplateColumns:'70px 100px 70px 100px',gap:'6px',marginTop:'4px'}}>
                  <label>Tipo :</label><input value={concurso.tipo} readOnly style={{...s.field,backgroundColor:'#ffd0d0',textAlign:'center'}} />
                  <label>Latitude :</label><input value={concurso.lat} readOnly style={{...s.field,backgroundColor:'#e8e8e8'}} />
                  <label>Data :</label><input value={concurso.data} readOnly style={{...s.field,backgroundColor:'#e8e8e8'}} />
                  <label>Longitude :</label><input value={concurso.lon} readOnly style={{...s.field,backgroundColor:'#e8e8e8'}} />
                </div>
              </div>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'8px'}}>
                <label>Do concorrente :</label>
                <input value={apagarConc.conc1} onChange={e=>setApagarConc({...apagarConc,conc1:e.target.value})} style={{...s.field,width:'30px',textAlign:'center'}} />/<input value={apagarConc.conc2} onChange={e=>setApagarConc({...apagarConc,conc2:e.target.value})} style={{...s.field,width:'30px',textAlign:'center'}} />/<input value={apagarConc.conc3} onChange={e=>setApagarConc({...apagarConc,conc3:e.target.value})} style={{...s.field,width:'50px',textAlign:'center'}} />
                <button style={s.tbtn} onClick={()=>setLupaConcorrente(true)}>🔍</button>
                <input style={{...s.field,flex:1,backgroundColor:'#e8e8e8'}} readOnly placeholder="Selecione concorrente" />
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'12px'}}>
                <button style={{...s.btn,backgroundColor:'#ffc0c0'}} onClick={()=>{ if(confirm('Apagar classificações concorrente '+apagarConc.conc1+'/'+apagarConc.conc2+'/'+apagarConc.conc3+'?')){ setMsg('Classificações concorrente apagadas'); close('apagarClassConcWin'); }}}>Confirmar</button>
                <button style={s.btn} onClick={()=>close('apagarClassConcWin')}>Sair</button>
              </div>
            </div>
          </div>
        )}
        
        {/* ===== TABELA DE ASSOCIACOES DISTRITAIS ===== */}
        {wins.includes('tabelaAssociacoes') && (
          <div style={{...s.win,width:'640px'}}>
            <div style={s.winTitle}><span>Tabela de Associações Distritais</span><button onClick={()=>close('tabelaAssociacoes')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'0'}}>
              <div style={{display:'flex',backgroundColor:'#c0c0c0',borderBottom:'1px solid #808080'}}>
                {['Editar','Consultar'].map(tab=> (
                  <button key={tab} onClick={()=>setAssocTab(tab)} style={{padding:'4px 16px',border:'1px solid #808080',backgroundColor: assocTab===tab ? '#c0c0c0' : '#a0a0a0',fontWeight: assocTab===tab ? 'bold':'normal'}}>{tab}</button>
                ))}
              </div>
              {assocTab==='Editar' && (
                <div style={{padding:'8px'}}>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                    <label style={{width:'100px'}}>Associação :</label>
                    <input value={assocEdit.codigo} onChange={e=>setAssocEdit({...assocEdit,codigo:e.target.value})} style={{...s.field,width:'40px',backgroundColor:'#b0d0ff',textAlign:'center',fontWeight:'bold'}} />
                  </div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'100px'}}>Nome :</label><input value={assocEdit.nome} onChange={e=>setAssocEdit({...assocEdit,nome:e.target.value})} style={{...s.field,flex:1}} /></div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'100px'}}>Morada :</label><input value={assocEdit.morada} onChange={e=>setAssocEdit({...assocEdit,morada:e.target.value})} style={{...s.field,flex:1}} /></div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'100px'}}>Localidade :</label><input value={assocEdit.localidade} onChange={e=>setAssocEdit({...assocEdit,localidade:e.target.value})} style={{...s.field,flex:1}} /></div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'100px'}}>Código Postal :</label><input value={assocEdit.cod1} onChange={e=>setAssocEdit({...assocEdit,cod1:e.target.value})} style={{...s.field,width:'50px',textAlign:'center'}} /><input value={assocEdit.cod2} onChange={e=>setAssocEdit({...assocEdit,cod2:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} /><input value={assocEdit.cod3} onChange={e=>setAssocEdit({...assocEdit,cod3:e.target.value})} style={{...s.field,flex:1}} /></div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'100px'}}>Telefone :</label><input value={assocEdit.telefone} onChange={e=>setAssocEdit({...assocEdit,telefone:e.target.value})} style={{...s.field,flex:1}} /><label style={{marginLeft:'8px'}}>Fax :</label><input value={assocEdit.fax} onChange={e=>setAssocEdit({...assocEdit,fax:e.target.value})} style={{...s.field,flex:1}} /></div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'8px'}}><label style={{width:'100px'}}>Email :</label><input value={assocEdit.email} onChange={e=>setAssocEdit({...assocEdit,email:e.target.value})} style={{...s.field,flex:1}} /></div>
                  <div style={{display:'flex',justifyContent:'center',gap:'6px'}}>
                    <button style={s.btn}>Novo</button><button style={{...s.btn,backgroundColor:'#c0ffc0'}} onClick={()=>{setMsg('Associação '+assocEdit.codigo+' guardada');}}>Guardar</button><button style={s.btn}>Desfazer</button><button style={{...s.btn,backgroundColor:'#ffc0c0'}}>Anular</button><button style={s.btn}>Imprimir</button><button style={s.btn} onClick={()=>close('tabelaAssociacoes')}>Sair</button>
                  </div>
                </div>
              )}
              {assocTab==='Consultar' && (
                <div style={{padding:'8px'}}>
                  <div style={{border:'2px inset #fff',backgroundColor:'#fff',height:'200px',overflowY:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px'}}>
                      <thead><tr style={{backgroundColor:'#000080',color:'#fff'}}><th style={{border:'1px solid #808080',padding:'3px'}}>Código</th><th style={{border:'1px solid #808080',padding:'3px'}}>Nome</th></tr></thead>
                      <tbody>{assocLista.map(a=> (<tr key={a.codigo} onClick={()=>{setAssocEdit(a); setAssocTab('Editar');}} style={{cursor:'pointer'}}><td style={{border:'1px solid #c0c0c0',padding:'2px 6px',textAlign:'center'}}>{a.codigo}</td><td style={{border:'1px solid #c0c0c0',padding:'2px 6px'}}>{a.nome}</td></tr>))}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* ===== TABELA DE COLECTIVIDADES ===== */}
        {wins.includes('tabelaColectividades') && (
          <div style={{...s.win,width:'680px'}}>
            <div style={s.winTitle}><span>Tabela de Colectividades</span><button onClick={()=>close('tabelaColectividades')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'0'}}>
              <div style={{display:'flex',backgroundColor:'#c0c0c0',borderBottom:'1px solid #808080'}}>
                {['Editar','Consultar'].map(tab=> (
                  <button key={tab} onClick={()=>setColecTab(tab)} style={{padding:'4px 16px',border:'1px solid #808080',backgroundColor: colecTab===tab ? '#c0c0c0' : '#a0a0a0',fontWeight: colecTab===tab ? 'bold':'normal'}}>{tab}</button>
                ))}
              </div>
              {colecTab==='Editar' && (
                <div style={{padding:'8px'}}>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}>
                    <label style={{width:'100px'}}>Associação :</label>
                    <input value={colecEdit.assoc} onChange={e=>setColecEdit({...colecEdit,assoc:e.target.value})} style={{...s.field,width:'40px',textAlign:'center',backgroundColor:'#b0d0ff',fontWeight:'bold'}} />
                    <button style={s.tbtn} onClick={()=>setLupaConcurso(true)}>🏢</button>
                    <input value={colecEdit.assocNome || assocLista.find(a=>a.codigo===colecEdit.assoc)?.nome || ''} onChange={e=>setColecEdit({...colecEdit,assocNome:e.target.value})} style={{...s.field,flex:1,backgroundColor:'#e8e8e8'}} readOnly />
                  </div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'100px'}}>Colectividade :</label><input value={colecEdit.colec} onChange={e=>setColecEdit({...colecEdit,colec:e.target.value})} style={{...s.field,width:'50px',textAlign:'center'}} /></div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'100px'}}>Nome :</label><input value={colecEdit.nome} onChange={e=>setColecEdit({...colecEdit,nome:e.target.value})} style={{...s.field,flex:1}} /></div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'100px'}}>Morada :</label><input value={colecEdit.morada} onChange={e=>setColecEdit({...colecEdit,morada:e.target.value})} style={{...s.field,flex:1}} /></div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'100px'}}>Localidade :</label><input value={colecEdit.localidade} onChange={e=>setColecEdit({...colecEdit,localidade:e.target.value})} style={{...s.field,flex:1}} /></div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'100px'}}>Código Postal :</label><input value={colecEdit.cod1} onChange={e=>setColecEdit({...colecEdit,cod1:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />/<input value={colecEdit.cod2} onChange={e=>setColecEdit({...colecEdit,cod2:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} /><input value={colecEdit.cod3} onChange={e=>setColecEdit({...colecEdit,cod3:e.target.value})} style={{...s.field,flex:1}} /></div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'100px'}}>Telefone :</label><input value={colecEdit.telefone} onChange={e=>setColecEdit({...colecEdit,telefone:e.target.value})} style={{...s.field,flex:1}} /><label style={{marginLeft:'8px'}}>Fax :</label><input value={colecEdit.fax} onChange={e=>setColecEdit({...colecEdit,fax:e.target.value})} style={{...s.field,flex:1}} /></div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'100px'}}>Email :</label><input value={colecEdit.email} onChange={e=>setColecEdit({...colecEdit,email:e.target.value})} style={{...s.field,flex:1}} /></div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'8px'}}><label style={{width:'100px'}}>Número da Federação :</label><input value={colecEdit.numFed} onChange={e=>setColecEdit({...colecEdit,numFed:e.target.value})} style={{...s.field,width:'50px',textAlign:'center'}} /></div>
                  <div style={{display:'flex',justifyContent:'center',gap:'6px'}}>
                    <button style={s.btn}>Novo</button><button style={{...s.btn,backgroundColor:'#c0ffc0'}} onClick={()=>setMsg('Colectividade guardada')}>Guardar</button><button style={s.btn}>Desfazer</button><button style={{...s.btn,backgroundColor:'#ffc0c0'}}>Anular</button><button style={s.btn}>Detalhe</button><button style={s.btn}>Simples</button><button style={s.btn} onClick={()=>close('tabelaColectividades')}>Sair</button>
                  </div>
                </div>
              )}
              {colecTab==='Consultar' && (
                <div style={{padding:'8px'}}>
                  <div style={{border:'2px inset #fff',backgroundColor:'#fff',height:'200px',overflowY:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px'}}>
                      <thead><tr style={{backgroundColor:'#000080',color:'#fff'}}><th style={{border:'1px solid #808080',padding:'3px'}}>Associação</th><th style={{border:'1px solid #808080',padding:'3px'}}>Colectividade</th><th style={{border:'1px solid #808080',padding:'3px'}}>Nome</th></tr></thead>
                      <tbody>{colecLista.map(c=> (<tr key={c.colec} onClick={()=>{setColecEdit(c); setColecTab('Editar');}} style={{cursor:'pointer'}}><td style={{border:'1px solid #c0c0c0',textAlign:'center'}}>{c.assoc}</td><td style={{border:'1px solid #c0c0c0',textAlign:'center'}}>{c.colec}</td><td style={{border:'1px solid #c0c0c0',padding:'2px 6px'}}>{c.nome}</td></tr>))}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* ===== TABELA DE CONCORRENTES ===== */}
        {wins.includes('tabelaConcorrentes') && (
          <div style={{...s.win,width:'780px'}}>
            <div style={s.winTitle}><span>Tabela de Concorrentes</span><button onClick={()=>close('tabelaConcorrentes')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'0'}}>
              <div style={{display:'flex',backgroundColor:'#c0c0c0',borderBottom:'1px solid #808080'}}>
                {['Editar','Consultar'].map(tab=> (
                  <button key={tab} onClick={()=>setConcTab(tab)} style={{padding:'4px 16px',border:'1px solid #808080',backgroundColor: concTab===tab ? '#c0c0c0' : '#a0a0a0',fontWeight: concTab===tab ? 'bold':'normal'}}>{tab}</button>
                ))}
              </div>
              {concTab==='Editar' && (
                <div style={{padding:'8px'}}>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}>
                    <label>Assoc./Colec. :</label>
                    <input value={concEdit.assoc} onChange={e=>setConcEdit({...concEdit,assoc:e.target.value})} style={{...s.field,width:'40px',backgroundColor:'#b0d0ff',textAlign:'center',fontWeight:'bold'}} />
                    <input value={concEdit.col} onChange={e=>setConcEdit({...concEdit,col:e.target.value})} style={{...s.field,width:'50px',textAlign:'center'}} />
                    <button style={s.tbtn} onClick={()=>setLupaConcorrente(true)}>Lupa</button>
                    <input style={{...s.field,flex:1,backgroundColor:'#e8e8e8'}} readOnly placeholder="Federação Paulista de Columbófila" />
                  </div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}>
                    <label style={{width:'90px'}}>Número :</label><input value={concEdit.num} onChange={e=>setConcEdit({...concEdit,num:e.target.value})} style={{...s.field,width:'60px',textAlign:'center'}} />
                  </div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'90px'}}>Nome :</label><input value={concEdit.nome} onChange={e=>setConcEdit({...concEdit,nome:e.target.value})} style={{...s.field,flex:1}} /></div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'90px'}}>Morada :</label><input value={concEdit.morada} onChange={e=>setConcEdit({...concEdit,morada:e.target.value})} style={{...s.field,flex:1}} /></div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'90px'}}>Localidade :</label><input value={concEdit.localidade} onChange={e=>setConcEdit({...concEdit,localidade:e.target.value})} style={{...s.field,flex:1}} /></div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'90px'}}>Código Postal :</label><input value={concEdit.cod1} onChange={e=>setConcEdit({...concEdit,cod1:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />/<input value={concEdit.cod2} onChange={e=>setConcEdit({...concEdit,cod2:e.target.value})} style={{...s.field,width:'60px'}} /></div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'90px'}}>Telefone :</label><input value={concEdit.telefone} onChange={e=>setConcEdit({...concEdit,telefone:e.target.value})} style={{...s.field,flex:1}} /><label style={{marginLeft:'8px'}}>Fax :</label><input value={concEdit.fax} onChange={e=>setConcEdit({...concEdit,fax:e.target.value})} style={{...s.field,flex:1}} /></div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'90px'}}>Email :</label><input value={concEdit.email} onChange={e=>setConcEdit({...concEdit,email:e.target.value})} style={{...s.field,flex:1}} /></div>
                  <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'4px',flexWrap:'wrap'}}>
                    <label>Licença Fed. :</label><input value={concEdit.licFed} onChange={e=>setConcEdit({...concEdit,licFed:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                    <label>Doublagem :</label><label><input type="radio" checked={concEdit.doublagem==='Não'} onChange={()=>setConcEdit({...concEdit,doublagem:'Não'})} /> Não</label><label><input type="radio" checked={concEdit.doublagem==='Sim'} onChange={()=>setConcEdit({...concEdit,doublagem:'Sim'})} /> Sim</label>
                    <label>Grupo de Fundo :</label><label><input type="radio" checked={concEdit.grupoFundo==='Não'} onChange={()=>setConcEdit({...concEdit,grupoFundo:'Não'})} /> Não</label><label><input type="radio" checked={concEdit.grupoFundo==='Sim'} onChange={()=>setConcEdit({...concEdit,grupoFundo:'Sim'})} /> Sim</label>
                  </div>
                  <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'4px',flexWrap:'wrap'}}>
                    <label>Paga Listagem :</label><label><input type="radio" checked={concEdit.pagaList==='Não'} onChange={()=>setConcEdit({...concEdit,pagaList:'Não'})} /> Não</label><label><input type="radio" checked={concEdit.pagaList==='Sim'} onChange={()=>setConcEdit({...concEdit,pagaList:'Sim'})} /> Sim</label>
                    <label>Tipo :</label><label><input type="radio" checked={concEdit.tipo==='Concorrente'} onChange={()=>setConcEdit({...concEdit,tipo:'Concorrente'})} /> Concorrente</label><label><input type="radio" checked={concEdit.tipo==='Sócio'} onChange={()=>setConcEdit({...concEdit,tipo:'Sócio'})} /> Sócio</label>
                    <label>Sorteio :</label><label><input type="radio" checked={concEdit.sorteio==='Não'} onChange={()=>setConcEdit({...concEdit,sorteio:'Não'})} /> Não</label><label><input type="radio" checked={concEdit.sorteio==='Sim'} onChange={()=>setConcEdit({...concEdit,sorteio:'Sim'})} /> Sim</label>
                  </div>
                  <div style={{border:'1px solid #808080',padding:'4px',marginBottom:'8px'}}>
                    <div style={{fontWeight:'bold',textAlign:'center',fontSize:'10px'}}>Coordenadas</div>
                    <div style={{display:'flex',gap:'8px',justifyContent:'center',marginTop:'4px',alignItems:'center'}}>
                      <label>Latitude :</label><input value={concEdit.latG} onChange={e=>setConcEdit({...concEdit,latG:e.target.value})} style={{...s.field,width:'40px'}} /><input value={concEdit.latM} onChange={e=>setConcEdit({...concEdit,latM:e.target.value})} style={{...s.field,width:'30px'}} /><input value={concEdit.latS} onChange={e=>setConcEdit({...concEdit,latS:e.target.value})} style={{...s.field,width:'50px'}} />
                      <label>Longitude :</label><input value={concEdit.lonG} onChange={e=>setConcEdit({...concEdit,lonG:e.target.value})} style={{...s.field,width:'40px'}} /><input value={concEdit.lonM} onChange={e=>setConcEdit({...concEdit,lonM:e.target.value})} style={{...s.field,width:'30px'}} /><input value={concEdit.lonS} onChange={e=>setConcEdit({...concEdit,lonS:e.target.value})} style={{...s.field,width:'50px'}} />
                    </div>
                  </div>
                  <div style={{display:'flex',justifyContent:'center',gap:'6px'}}>
                    <button style={s.btn}>Novo</button><button style={{...s.btn,backgroundColor:'#c0ffc0'}} onClick={salvarConcorrente}>Guardar</button><button style={s.btn}>Desfazer</button><button style={{...s.btn,backgroundColor:'#ffc0c0'}}>Anular</button><button style={s.btn} onClick={()=>close('tabelaConcorrentes')}>Sair</button>
                  </div>
                </div>
              )}
              {concTab==='Consultar' && (
                <div style={{padding:'8px'}}>
                  <div style={{border:'2px inset #fff',backgroundColor:'#fff',height:'280px',overflowY:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px'}}>
                      <thead><tr style={{backgroundColor:'#000080',color:'#fff'}}><th style={{border:'1px solid #808080',padding:'3px'}}>Assoc.</th><th style={{border:'1px solid #808080',padding:'3px'}}>Col.</th><th style={{border:'1px solid #808080',padding:'3px'}}>Número</th><th style={{border:'1px solid #808080',padding:'3px'}}>Nome</th></tr></thead>
                      <tbody>{concorrentesLista.map(c=> (<tr key={c.num} onClick={()=>{setConcEdit({assoc:c.assoc,col:c.col,num:c.num,nome:c.nome,morada:'',localidade:'',cod1:'0',cod2:'',telefone:'',fax:'',email:'',licFed:'0',doublagem:'Não',grupoFundo:'Não',pagaList:'Não',tipo:'Concorrente',sorteio:'Não',latG:c.lat.split('-')[0]||'',latM:c.lat.split('-')[1]||'',latS:c.lat.split('-')[2]||'',lonG:c.lon.split('-')[0]||'',lonM:c.lon.split('-')[1]||'',lonS:c.lon.split('-')[2]||''}); setConcTab('Editar');}} style={{cursor:'pointer'}}><td style={{border:'1px solid #c0c0c0',padding:'2px 4px',textAlign:'center'}}>{c.assoc}</td><td style={{border:'1px solid #c0c0c0',padding:'2px 4px',textAlign:'center'}}>{c.col}</td><td style={{border:'1px solid #c0c0c0',padding:'2px 4px',textAlign:'center'}}>{c.num}</td><td style={{border:'1px solid #c0c0c0',padding:'2px 4px'}}>{c.nome}</td></tr>))}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* LISTAGEM DE CONCORRENTES */}
        {wins.includes('listagemConcorrentesWin') && (
          <div style={{...s.win,width:'620px'}}>
            <div style={s.winTitle}><span>Listagem de Concorrentes</span><button onClick={()=>close('listagemConcorrentesWin')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'6px'}}>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'4px'}}>
                <label>Da colectividade :</label>
                <input value={listConcWin.deAssoc} onChange={e=>setListConcWin({...listConcWin,deAssoc:e.target.value})} style={{...s.field,width:'40px',textAlign:'center',backgroundColor:'#b0d0ff',fontWeight:'bold'}} />/<input value={listConcWin.deColec} onChange={e=>setListConcWin({...listConcWin,deColec:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                <span style={{flex:1,backgroundColor:'#e8e8e8',border:'2px inset #fff',padding:'2px 6px',color:'#000080',fontWeight:'bold'}}>Federacao Paulista de Columbiofilia</span>
              </div>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                <label>à colectividade :</label>
                <input value={listConcWin.ateAssoc} onChange={e=>setListConcWin({...listConcWin,ateAssoc:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />/<input value={listConcWin.ateColec} onChange={e=>setListConcWin({...listConcWin,ateColec:e.target.value})} style={{...s.field,width:'40px',textAlign:'center'}} />
                <span style={{flex:1,backgroundColor:'#e8e8e8',border:'2px inset #fff',padding:'2px 6px',color:'#000080'}}>Federacao Paulista de Columbiofilia</span>
              </div>
              <div style={{display:'flex',gap:'12px',marginBottom:'4px'}}>
                <div style={{border:'1px solid #808080',padding:'4px',flex:1}}>
                  <div style={{fontWeight:'bold',fontSize:'10px'}}>Concorrentes:</div>
                  <label><input type="radio" checked={listConcWin.conc1==='Todos'} onChange={()=>setListConcWin({...listConcWin,conc1:'Todos'})} /> Todos</label><label><input type="radio" checked={listConcWin.conc1==='Só Grupo de fundo'} onChange={()=>setListConcWin({...listConcWin,conc1:'Só Grupo de fundo'})} /> Só Grupo de fundo</label><label><input type="radio" checked={listConcWin.conc1==='Só de Doublagem'} onChange={()=>setListConcWin({...listConcWin,conc1:'Só de Doublagem'})} /> Só de Doublagem</label>
                </div>
                <div style={{border:'1px solid #808080',padding:'4px',flex:1}}>
                  <div style={{fontWeight:'bold',fontSize:'10px'}}>Concorrentes:</div>
                  <label><input type="radio" checked={listConcWin.conc2==='Todos'} onChange={()=>setListConcWin({...listConcWin,conc2:'Todos'})} /> Todos</label><label><input type="radio" checked={listConcWin.conc2==='Pagam listagem'} onChange={()=>setListConcWin({...listConcWin,conc2:'Pagam listagem'})} /> Pagam listagem</label>
                </div>
              </div>
              <div style={{display:'flex',gap:'12px',marginBottom:'4px'}}>
                <div style={{border:'1px solid #808080',padding:'4px',flex:1}}>
                  <div style={{fontWeight:'bold',fontSize:'10px'}}>Tipo :</div>
                  <label><input type="radio" checked={listConcWin.tipo==='Simples I'} onChange={()=>setListConcWin({...listConcWin,tipo:'Simples I'})} /> Simples I</label><br/>
                  <label><input type="radio" checked={listConcWin.tipo==='Simples II'} onChange={()=>setListConcWin({...listConcWin,tipo:'Simples II'})} /> Simples II</label><br/>
                  <label><input type="radio" checked={listConcWin.tipo==='Detalhada'} onChange={()=>setListConcWin({...listConcWin,tipo:'Detalhada'})} /> Detalhada</label>
                </div>
                <div style={{border:'1px solid #808080',padding:'4px',flex:1}}>
                  <div style={{fontWeight:'bold',fontSize:'10px'}}>Ordenação :</div>
                  <label><input type="radio" checked={listConcWin.ordenacao==='Numérica'} onChange={()=>setListConcWin({...listConcWin,ordenacao:'Numérica'})} /> Numérica</label><br/>
                  <label><input type="radio" checked={listConcWin.ordenacao==='Alfabética'} onChange={()=>setListConcWin({...listConcWin,ordenacao:'Alfabética'})} /> Alfabética</label>
                </div>
              </div>
              <div style={{border:'2px groove #fff',padding:'4px',backgroundColor:'#d4d0c8',marginBottom:'6px',display:'flex',gap:'8px',alignItems:'center'}}>
                <label>Destino :</label><label><input type="radio" checked={listConcWin.destino==='Impressora'} onChange={()=>setListConcWin({...listConcWin,destino:'Impressora'})} /> Impressora</label><label><input type="radio" checked={listConcWin.destino==='Ficheiro Excel'} onChange={()=>setListConcWin({...listConcWin,destino:'Ficheiro Excel'})} /> Ficheiro Excel</label><input placeholder="C:\\SGSP\\EXP\\" style={{...s.field,flex:1}} />
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'12px'}}>
                <button style={{...s.btn,minWidth:'90px'}} onClick={()=>open('listagemConcorrentesPreview')}>Imprimir</button>
                <button style={{...s.btn,minWidth:'90px'}} onClick={()=>close('listagemConcorrentesWin')}>Sair</button>
              </div>
            </div>
          </div>
        )}
        {wins.includes('listagemConcorrentesPreview') && (
          <div style={{...s.win,width:'860px'}}>
            <div style={s.winTitle}><span>Print Preview - Listagem de Concorrentes</span><button onClick={()=>close('listagemConcorrentesPreview')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,backgroundColor:'#fff',fontFamily:'Courier New, monospace',fontSize:'9px'}}>
              <div style={{display:'flex',gap:'4px',alignItems:'center',backgroundColor:'#c0c0c0',border:'1px solid #808080',padding:'3px 6px',margin:'-8px -8px 6px -8px'}}><button style={{...s.tbtn,padding:'1px 4px'}}>|&lt;&lt;</button><button style={{...s.tbtn,padding:'1px 4px'}}>&lt;</button><button style={{...s.tbtn,padding:'1px 4px'}}>&gt;</button><button style={{...s.tbtn,padding:'1px 4px'}}>&gt;&gt;|</button><select style={{...s.field,marginLeft:'8px'}}><option>100%</option></select><button style={s.tbtn}>Print</button></div>
              <div style={{textAlign:'center',fontWeight:'bold',color:'#008080',fontSize:'12px'}}>CLUBE COLUMBOMFILO LIMEIRENSE</div>
              <div style={{textAlign:'center',fontWeight:'bold'}}>Listagem simples de Concorrentes, por ordem {listConcWin.ordenacao.toLowerCase()}.</div>
              <div style={{fontSize:'9px',marginTop:'4px'}}>Da colectividade {listConcWin.deAssoc}/{listConcWin.deColec} à colectividade {listConcWin.ateAssoc}/{listConcWin.ateColec}</div>
              <div style={{textAlign:'center',fontWeight:'bold',marginTop:'4px'}}>Colectividade: {listConcWin.deAssoc}/{listConcWin.deColec} &nbsp; Nome: Federacao Paulista de Columbiofilia</div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'9px',marginTop:'4px'}}>
                <thead><tr style={{backgroundColor:'#c0c0c0'}}><th style={{border:'1px solid #000',padding:'2px'}}>Num.</th><th style={{border:'1px solid #000',padding:'2px'}}>Nome</th><th style={{border:'1px solid #000',padding:'2px'}}>Latitude</th><th style={{border:'1px solid #000',padding:'2px'}}>Longitude</th><th style={{border:'1px solid #000',padding:'2px'}}>N.L.F.</th></tr></thead>
                <tbody>{concorrentesLista.map(c=> (<tr key={c.num}><td style={{border:'1px solid #c0c0c0',padding:'1px 4px',textAlign:'center'}}>{c.num}</td><td style={{border:'1px solid #c0c0c0',padding:'1px 4px'}}>{c.nome}</td><td style={{border:'1px solid #c0c0c0',padding:'1px 4px',textAlign:'center'}}>{c.lat}</td><td style={{border:'1px solid #c0c0c0',padding:'1px 4px',textAlign:'center'}}>{c.lon}</td><td style={{border:'1px solid #c0c0c0',padding:'1px 4px',textAlign:'center'}}>{c.nlf}</td></tr>))}</tbody>
              </table>
            </div>
          </div>
        )}
        {/* EXPORTACAO DE CONCORRENTES */}
        {wins.includes('exportacaoConcorrentesWin') && (
          <div style={{...s.win,width:'540px'}}>
            <div style={s.winTitle}><span>Exportação de Concorrentes</span><button onClick={()=>close('exportacaoConcorrentesWin')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'8px',textAlign:'center'}}>
              <div style={{color:'#000080',fontWeight:'bold'}}>Vai proceder à exportação de dados de concorrentes.</div>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginTop:'12px',justifyContent:'center'}}>
                <label>Da colectividade :</label>
                <input value={listConcWin.deAssoc} style={{...s.field,width:'40px',textAlign:'center',backgroundColor:'#b0d0ff'}} readOnly /><input value={listConcWin.deColec} style={{...s.field,width:'40px',textAlign:'center'}} readOnly />
                <span style={{flex:1,backgroundColor:'#e8e8e8',border:'2px inset #fff',padding:'2px 6px',textAlign:'left'}}>Federacao Paulista de Columbiofilia</span>
              </div>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginTop:'6px',justifyContent:'center'}}>
                <label>à colectividade :</label>
                <input value={listConcWin.ateAssoc} style={{...s.field,width:'40px',textAlign:'center'}} readOnly /><input value={listConcWin.ateColec} style={{...s.field,width:'40px',textAlign:'center'}} readOnly />
                <span style={{flex:1,backgroundColor:'#e8e8e8',border:'2px inset #fff',padding:'2px 6px',textAlign:'left'}}>Federacao Paulista de Columbiofilia</span>
              </div>
              <div style={{border:'1px solid #808080',padding:'6px',marginTop:'8px',display:'flex',gap:'8px',alignItems:'center',justifyContent:'center'}}>
                <label>Destino :</label><label><input type="radio" defaultChecked /> Disquete</label><label><input type="radio" /> Outra Localização</label>
                <label>Localização :</label><input style={{...s.field,flex:1}} />
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'12px',marginTop:'12px'}}>
                <button style={{...s.btn,minWidth:'90px'}} onClick={()=>{ const csv=concorrentesLista.map(c=> c.assoc+' , '+c.col+', '+c.num+','+c.nome).join('\n'); const b=new Blob([csv],{type:'text/plain'}); const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download='EXPORT_CONCORRENTES_'+listConcWin.deAssoc+'_'+listConcWin.deColec+'.csv'; a.click(); URL.revokeObjectURL(u); setMsg('Exportação concluída'); close('exportacaoConcorrentesWin'); }}>Confirmar</button>
                <button style={s.btn} onClick={()=>close('exportacaoConcorrentesWin')}>Sair</button>
              </div>
            </div>
          </div>
        )}
        
        {/* ===== MANUTENCAO DE POMBOS ===== */}
        {wins.includes('manutencaoPombosWin') && (
          <div style={{...s.win,width:'640px'}}>
            <div style={s.winTitle}><span>Manutenção de Pombos</span><button onClick={()=>close('manutencaoPombosWin')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'0'}}>
              <div style={{display:'flex',backgroundColor:'#c0c0c0',borderBottom:'2px groove #fff'}}>
                {['Editar','Consultar'].map(tab=> (
                  <button key={tab} onClick={()=>setPomboTab(tab)} style={{flex:1,padding:'5px',border:'1px solid #808080',backgroundColor: pomboTab===tab ? '#c0c0c0' : '#a0a0a0',fontWeight: pomboTab===tab ? 'bold':'normal',borderBottom: pomboTab===tab ? 'none':'1px solid #808080',textDecoration: pomboTab===tab ? 'underline':'none'}}>{tab}</button>
                ))}
              </div>
              {pomboTab==='Editar' && (
                <div style={{padding:'8px',backgroundColor:'#c0c0c0'}}>
                  {pomboEdit.anilha==='1134642/21' && <div style={{textAlign:'right',color:'#ff0000',fontWeight:'bold',fontSize:'11px',marginBottom:'2px'}}>Alteração</div>}
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                    <label style={{width:'80px',textAlign:'right',fontWeight:'bold'}}>Pombo :</label>
                    <input value={pomboEdit.anilha} onChange={e=>setPomboEdit({...pomboEdit,anilha:e.target.value})} style={{...s.field,backgroundColor:'#000080',color:'#fff',width:'100px',textAlign:'center',fontWeight:'bold'}} placeholder="0000023/22" />
                    <span style={{fontSize:'9px',color:'#808080'}}>Anilha/Ano</span>
                  </div>
                  <div style={{border:'1px solid #808080',padding:'6px',marginBottom:'6px',backgroundColor:'#c0c0c0'}}>
                    <div style={{display:'flex',gap:'4px',alignItems:'center',marginBottom:'4px'}}>
                      <label style={{width:'80px',textAlign:'right'}}>Concorrente :</label>
                      <input value={pomboEdit.assoc} onChange={e=>setPomboEdit({...pomboEdit,assoc:e.target.value})} style={{...s.field,width:'30px',textAlign:'center',backgroundColor:'#b0d0ff',fontWeight:'bold'}} />
                      <input value={pomboEdit.colec} onChange={e=>setPomboEdit({...pomboEdit,colec:e.target.value})} style={{...s.field,width:'30px',textAlign:'center'}} />
                      <span>/</span>
                      <input value={pomboEdit.num} onChange={e=>setPomboEdit({...pomboEdit,num:e.target.value})} style={{...s.field,width:'50px',textAlign:'center'}} />
                      <button style={{...s.tbtn,padding:'1px 3px',fontSize:'10px'}} onClick={()=>{setLupaTarget('manutencaoPombos'); setLupaConcorrente(true);}} title="Pesquisar concorrente">🔍</button>
                      <input value={pomboEdit.nome} onChange={e=>setPomboEdit({...pomboEdit,nome:e.target.value})} style={{...s.field,flex:1,backgroundColor:'#e8e8e8'}} placeholder="Nome do concorrente" />
                    </div>
                    <div style={{display:'flex',gap:'4px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'80px',textAlign:'right'}}>Morada :</label><input value={pomboEdit.morada} onChange={e=>setPomboEdit({...pomboEdit,morada:e.target.value})} style={{...s.field,flex:1}} /></div>
                    <div style={{display:'flex',gap:'4px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'80px',textAlign:'right'}}>Localidade :</label><input value={pomboEdit.localidade} onChange={e=>setPomboEdit({...pomboEdit,localidade:e.target.value})} style={{...s.field,flex:1}} /></div>
                    <div style={{display:'flex',gap:'4px',alignItems:'center',marginBottom:'4px'}}><label style={{width:'80px',textAlign:'right'}}>Código Postal :</label><input value={pomboEdit.cod1} onChange={e=>setPomboEdit({...pomboEdit,cod1:e.target.value})} style={{...s.field,width:'30px',textAlign:'center'}} /><span>-</span><input value={pomboEdit.cod2} onChange={e=>setPomboEdit({...pomboEdit,cod2:e.target.value})} style={{...s.field,width:'50px'}} /><input style={{...s.field,flex:1,marginLeft:'6px'}} placeholder="" /></div>
                    <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                      <label style={{width:'80px',textAlign:'right'}}>Telefone :</label><input value={pomboEdit.telefone} onChange={e=>setPomboEdit({...pomboEdit,telefone:e.target.value})} style={{...s.field,width:'120px'}} />
                      <label style={{marginLeft:'8px'}}>Sexo:</label>
                      <div style={{border:'1px solid #808080',padding:'2px 6px',display:'flex',gap:'6px',backgroundColor:'#d4d0c8'}}>
                        {['Macho','Fêmea','????'].map(v=> <label key={v} style={{fontSize:'10px'}}><input type="radio" checked={pomboEdit.sexo===v} onChange={()=>setPomboEdit({...pomboEdit,sexo:v})} /> {v}</label>)}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:'12px',marginBottom:'6px'}}>
                      <div style={{border:'1px solid #808080',padding:'3px 8px',display:'flex',gap:'8px',alignItems:'center'}}>
                        <span>Pombo de Fé :</span>
                        {['Não','Sim'].map(v=> <label key={v}><input type="radio" checked={pomboEdit.pomboFe===v} onChange={()=>setPomboEdit({...pomboEdit,pomboFe:v})} /> {v}</label>)}
                      </div>
                      <div style={{border:'1px solid #808080',padding:'3px 8px',display:'flex',gap:'8px',alignItems:'center'}}>
                        <span>Equipa Fixa :</span>
                        {['Não','Sim'].map(v=> <label key={v}><input type="radio" checked={pomboEdit.equipaFixa===v} onChange={()=>setPomboEdit({...pomboEdit,equipaFixa:v})} /> {v}</label>)}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                      <label>Data de introdução no sistema :</label>
                      <input value={pomboEdit.dataIntro} onChange={e=>setPomboEdit({...pomboEdit,dataIntro:e.target.value})} style={{...s.field,width:'90px',textAlign:'center'}} placeholder="//" />
                      <button style={{...s.tbtn,padding:'1px 4px'}}>📅</button>
                    </div>
                  </div>
                  <div style={{display:'flex',justifyContent:'center',gap:'4px',borderTop:'2px groove #fff',paddingTop:'6px'}}>
                    <button style={{...s.btn,display:'flex',flexDirection:'column',alignItems:'center',minWidth:'60px',padding:'3px 6px'}} onClick={()=>setPomboEdit({anilha:'',assoc:'0',colec:'',num:'0',nome:'',morada:'',localidade:'',cod1:'0',cod2:'',telefone:'',sexo:'Macho',pomboFe:'Não',equipaFixa:'Não',dataIntro:'//'})}><span>📄</span>Novo</button>
                    <button style={{...s.btn,display:'flex',flexDirection:'column',alignItems:'center',minWidth:'60px',backgroundColor:'#c0ffc0',padding:'3px 6px'}} onClick={salvarPombo}><span>💾</span>Guardar</button>
                    <button style={{...s.btn,display:'flex',flexDirection:'column',alignItems:'center',minWidth:'60px',padding:'3px 6px'}}><span>↩️</span>Desfazer</button>
                    <button style={{...s.btn,display:'flex',flexDirection:'column',alignItems:'center',minWidth:'60px',backgroundColor:'#ffc0c0',padding:'3px 6px'}}><span>❌</span>Anular</button>
                    <button style={{...s.btn,display:'flex',flexDirection:'column',alignItems:'center',minWidth:'60px',padding:'3px 6px'}} onClick={()=>close('manutencaoPombosWin')}><span>🚪</span>Sair</button>
                  </div>
                </div>
              )}
              {pomboTab==='Consultar' && (
                <div style={{padding:'8px',backgroundColor:'#c0c0c0'}}>
                  <div style={{textAlign:'center',fontWeight:'bold',color:'#000080',marginBottom:'4px',fontStyle:'italic'}}>Visualização de Pombos</div>
                  <div style={{border:'2px inset #fff',backgroundColor:'#fff',height:'300px',overflowY:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px'}}>
                      <thead><tr style={{backgroundColor:'#c0c0c0',position:'sticky',top:0}}><th style={{border:'1px solid #808080',padding:'3px 6px'}}>Anilha</th><th style={{border:'1px solid #808080',padding:'3px 6px'}}>Assoc.</th><th style={{border:'1px solid #808080',padding:'3px 6px'}}>Colec.</th><th style={{border:'1px solid #808080',padding:'3px 6px'}}>Número</th><th style={{border:'1px solid #808080',padding:'3px 6px'}}>Sexo</th></tr></thead>
                      <tbody>{pombosLista.map(p=> (
                        <tr key={p.anilha} onClick={()=>{setPomboEdit({anilha:p.anilha,assoc:p.assoc,colec:p.colec,num:p.num,nome: concorrentesLista.find(c=>c.num===p.num)?.nome || '',morada:'',localidade:'',cod1:'0',cod2:'',telefone:'',sexo:p.sexo==='M'?'Macho':'Fêmea',pomboFe:'Não',equipaFixa:'Não',dataIntro:'//'}); setPomboTab('Editar');}} style={{cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.backgroundColor='#000080'} onMouseLeave={e=>e.currentTarget.style.backgroundColor='transparent'}>
                          <td style={{border:'1px solid #c0c0c0',padding:'2px 4px',textAlign:'center',fontFamily:'monospace'}}>{p.anilha}</td><td style={{border:'1px solid #c0c0c0',padding:'2px 4px',textAlign:'center'}}>{p.assoc}</td><td style={{border:'1px solid #c0c0c0',padding:'2px 4px',textAlign:'center'}}>{p.colec}</td><td style={{border:'1px solid #c0c0c0',padding:'2px 4px',textAlign:'center'}}>{p.num}</td><td style={{border:'1px solid #c0c0c0',padding:'2px 4px',textAlign:'center'}}>{p.sexo}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                  <div style={{textAlign:'right',fontSize:'10px',color:'#808080',marginTop:'2px'}}>{pombosLista.length} pombos • clique para editar</div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* ===== LISTAGEM DE POMBOS ===== */}
        {wins.includes('listagemPombosWin') && (
          <div style={{...s.win,width:'560px'}}>
            <div style={s.winTitle}><span>Listagem de Pombos</span><button onClick={()=>close('listagemPombosWin')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'10px'}}>
              <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'6px'}}>
                <label style={{width:'110px',textAlign:'right'}}>Do pombo :</label>
                <input value={listPombosWin.dePombo} onChange={e=>setListPombosWin({...listPombosWin,dePombo:e.target.value})} style={{...s.field,width:'90px',backgroundColor:'#b0d0ff',textAlign:'center',fontWeight:'bold'}} />
                <label>ao pombo :</label>
                <input value={listPombosWin.atePombo} onChange={e=>setListPombosWin({...listPombosWin,atePombo:e.target.value})} style={{...s.field,width:'90px',textAlign:'center'}} />
              </div>
              <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'6px'}}>
                <label style={{width:'110px',textAlign:'right'}}>Do concorrente :</label>
                <input value={listPombosWin.deAssoc} onChange={e=>setListPombosWin({...listPombosWin,deAssoc:e.target.value})} style={{...s.field,width:'30px',textAlign:'center',backgroundColor:'#b0d0ff'}} />
                <input value={listPombosWin.deColec} onChange={e=>setListPombosWin({...listPombosWin,deColec:e.target.value})} style={{...s.field,width:'30px',textAlign:'center'}} />
                <span>/</span>
                <input value={listPombosWin.deNum} onChange={e=>setListPombosWin({...listPombosWin,deNum:e.target.value})} style={{...s.field,width:'50px',textAlign:'center'}} />
                <button style={s.tbtn} onClick={()=>{setLupaTarget('listPombosDe'); setLupaConcorrente(true);}} title="Pesquisar concorrente">🔍</button>
                <span style={{flex:1,backgroundColor:'#e8e8e8',border:'2px inset #fff',padding:'2px 6px',fontSize:'10px',color:'#000080',fontWeight:'bold'}}>{listPombosWin.deNome|| concorrentesLista.find(c=>c.num===listPombosWin.deNum)?.nome || '...'}</span>
              </div>
              <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'6px'}}>
                <label style={{width:'110px',textAlign:'right'}}>ao concorrente :</label>
                <input value={listPombosWin.ateAssoc} onChange={e=>setListPombosWin({...listPombosWin,ateAssoc:e.target.value})} style={{...s.field,width:'30px',textAlign:'center'}} />
                <input value={listPombosWin.ateColec} onChange={e=>setListPombosWin({...listPombosWin,ateColec:e.target.value})} style={{...s.field,width:'30px',textAlign:'center'}} />
                <span>/</span>
                <input value={listPombosWin.ateNum} onChange={e=>setListPombosWin({...listPombosWin,ateNum:e.target.value})} style={{...s.field,width:'50px',textAlign:'center'}} />
                <button style={s.tbtn} onClick={()=>{setLupaTarget('listPombosAte'); setLupaConcorrente(true);}} title="Pesquisar concorrente">🔍</button>
                <span style={{flex:1,backgroundColor:'#e8e8e8',border:'2px inset #fff',padding:'2px 6px',fontSize:'10px',color:'#000080'}}>{listPombosWin.ateNome || concorrentesLista.find(c=>c.num===listPombosWin.ateNum)?.nome || '...'}</span>
              </div>
              <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'8px'}}>
                <label style={{width:'110px',textAlign:'right'}}>Da data de registo</label>
                <input value={listPombosWin.deData} onChange={e=>setListPombosWin({...listPombosWin,deData:e.target.value})} style={{...s.field,width:'90px',textAlign:'center'}} placeholder=" / / " />
                <label>à data</label>
                <input value={listPombosWin.ateData} onChange={e=>setListPombosWin({...listPombosWin,ateData:e.target.value})} style={{...s.field,width:'90px',textAlign:'center'}} />
              </div>
              <div style={{border:'1px solid #808080',padding:'6px',marginBottom:'10px'}}>
                <div style={{fontWeight:'bold',fontSize:'10px',marginBottom:'4px'}}>Tipo :</div>
                <div style={{display:'flex',gap:'12px',flexWrap:'wrap',fontSize:'11px'}}>
                  {['Por pombo','Por concorrente','Por colectividade','Compactada'].map(t=> (
                    <label key={t}><input type="radio" checked={listPombosWin.tipo===t} onChange={()=>setListPombosWin({...listPombosWin,tipo:t})} /> {t}</label>
                  ))}
                </div>
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:'12px'}}>
                <button style={{...s.btn,minWidth:'100px'}} onClick={()=>open('listagemPombosPreview')}><span>🖨️</span> Imprimir</button>
                <button style={s.btn} onClick={()=>close('listagemPombosWin')}><span>🚪</span> Sair</button>
              </div>
            </div>
          </div>
        )}
        {wins.includes('listagemPombosPreview') && (
          <div style={{...s.win,width:'820px'}}>
            <div style={s.winTitle}><span>Print Preview - Listagem de Pombos</span><button onClick={()=>close('listagemPombosPreview')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,backgroundColor:'#fff',fontFamily:'Courier New, monospace',fontSize:'9px',maxHeight:'70vh',overflowY:'auto'}}>
              <div style={{display:'flex',gap:'4px',alignItems:'center',backgroundColor:'#c0c0c0',border:'1px solid #808080',padding:'3px 6px',margin:'-8px -8px 6px -8px'}}><button style={{...s.tbtn,padding:'1px 4px'}}>|&lt;&lt;</button><button style={{...s.tbtn,padding:'1px 4px'}}>&lt;</button><button style={{...s.tbtn,padding:'1px 4px'}}>&gt;</button><button style={{...s.tbtn,padding:'1px 4px'}}>&gt;&gt;|</button><select style={{...s.field,marginLeft:'8px'}}><option>100%</option></select><span style={{marginLeft:'8px',fontFamily:'sans-serif',fontSize:'9px'}}>Do concorrente {listPombosWin.deAssoc}/{listPombosWin.deColec}/{listPombosWin.deNum} ao concorrente {listPombosWin.ateAssoc}/{listPombosWin.ateColec}/{listPombosWin.ateNum}</span><button style={{...s.tbtn,marginLeft:'auto'}}>Print</button></div>
              <div style={{textAlign:'center',fontWeight:'bold',color:'#008080',fontSize:'13px',fontFamily:'Arial'}}>CLUBE COLUMBÓFILO LIMEIRENSE</div>
              <div style={{textAlign:'center',fontWeight:'bold'}}>Listagem de Pombos</div>
              <div style={{fontSize:'9px',borderBottom:'1px solid #000',paddingBottom:'4px',marginBottom:'4px'}}>
                Do pombo {listPombosWin.dePombo} ao pombo {listPombosWin.atePombo}<br/>
                Do concorrente {listPombosWin.deAssoc}/{listPombosWin.deColec} / {listPombosWin.deNum} - {listPombosWin.deNome} ao concorrente {listPombosWin.ateAssoc}/{listPombosWin.ateColec} / {listPombosWin.ateNum} - {listPombosWin.ateNome}<br/>
                Da data de registo {listPombosWin.deData||' / / '} à data {listPombosWin.ateData}<br/>
                {listPombosWin.tipo}
              </div>
              <div style={{backgroundColor:'#000080',color:'#fff',fontWeight:'bold',padding:'2px 6px',fontSize:'10px'}}>Concorrente: {listPombosWin.deColec} / {listPombosWin.deNum} &nbsp; {listPombosWin.deNome}</div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'9px'}}>
                <thead><tr style={{backgroundColor:'#c0c0c0'}}><th style={{border:'1px solid #000',padding:'2px',textAlign:'left'}}>Anilha</th><th style={{border:'1px solid #000',padding:'2px'}}>S</th><th style={{border:'1px solid #000',padding:'2px'}}>Colectividade</th></tr></thead>
                <tbody>{pombosLista.filter(p=> Number(p.num) >= Number(listPombosWin.deNum) && Number(p.num) <= Number(listPombosWin.ateNum) || listPombosWin.tipo==='Por concorrente' ).slice(0,60).map(p=> (<tr key={p.anilha}><td style={{border:'1px solid #c0c0c0',padding:'1px 4px',fontFamily:'monospace'}}>{p.anilha}</td><td style={{border:'1px solid #c0c0c0',padding:'1px 4px',textAlign:'center'}}>{p.sexo}</td><td style={{border:'1px solid #c0c0c0',padding:'1px 4px'}}>{p.colec} &nbsp; Federação Paulista de Columbófila</td></tr>))}</tbody>
              </table>
              <div style={{textAlign:'center',fontSize:'8px',color:'#808080',marginTop:'8px'}}>— Fim da listagem · {pombosLista.length} registos · {listPombosWin.tipo} —</div>
            </div>
          </div>
        )}
                {wins.includes('sobreWin') && (
          <div style={{...s.win,width:'460px'}}>
            <div style={s.winTitle}><span>Sobre — S.G.S.P</span><button onClick={()=>close('sobreWin')} style={s.tbtn}>X</button></div>
            <div style={{...s.body,padding:'16px',textAlign:'center'}}>
              <div style={{fontSize:'22px',fontWeight:'bold',color:'#000080'}}>S.G.S.P</div>
              <div style={{fontSize:'13px',fontWeight:'bold',marginTop:'4px'}}>Sistema Gestão Columbófila</div>
              <div style={{fontSize:'11px',color:'#333',marginTop:'6px'}}>Gestão de Pombos e Classificações</div>
              <div style={{height:'1px',backgroundColor:'#808080',margin:'10px 0'}}></div>
              <div style={{fontSize:'11px'}}>Desenvolvido por <b>nós</b></div>
              <div style={{fontSize:'10px',color:'#000080',marginTop:'4px',fontWeight:'bold'}}>CLUBE COLUMBÓFILO LIMEIRENSE</div>
              <div style={{fontSize:'9px',color:'#808080',marginTop:'2px'}}>S.G.S.P v5.0 — Vincenty WGS84 — Limeira/SP</div>
              <div style={{display:'flex',justifyContent:'center',gap:'8px',marginTop:'14px'}}>
                <button style={{...s.btn,minWidth:'80px'}} onClick={()=>close('sobreWin')}>OK</button>
              </div>
            </div>
          </div>
        )}
                        {/* OUTROS */}
        {wins.includes('socios') && (
          <div style={s.win}>
            <div style={s.winTitle}><span>Concorrente — Concorrentes / Sócios</span><button onClick={()=>close('socios')} style={s.tbtn}>X</button></div>
            <div style={s.body}>
              <table style={{width:'100%',borderCollapse:'collapse',backgroundColor:'#fff',fontSize:'11px'}}>
                <thead><tr style={{backgroundColor:'#000080',color:'#fff'}}><th style={{border:'1px solid #000',padding:'4px'}}>Licença</th><th style={{border:'1px solid #000',padding:'4px'}}>Nome</th><th style={{border:'1px solid #000',padding:'4px'}}>Morada</th></tr></thead>
                <tbody>{socios.map(sc=><tr key={sc.id}><td style={{border:'1px solid #c0c0c0',padding:'3px'}}>{sc.lic}</td><td style={{border:'1px solid #c0c0c0',padding:'3px'}}>{sc.nome}</td><td style={{border:'1px solid #c0c0c0',padding:'3px'}}>{gms(sc.lat,sc.lon).lat}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      <div style={s.status}><span>{msg}</span><span>User (GpblUser) | Record 1/1 | Record Unlocked | NUM 07:52 09/02/2026</span></div>
    </div>
  );
}
