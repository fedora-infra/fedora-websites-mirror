$( document ).ready(function() {
  // If there's no "magazineposts" place, ignore this function
  if(!$('#magazineposts').length)
	  return;

  $.get( "/magazine.json")
   .done(function( data ) {
     $.each(data, function(i, item){
       const postlink = item.link;
       const posttitle = item.title;
       const date = new Date(item.date);
       const month = date.toLocaleString('en-us', { month: 'long' });
       const postdate = ( month + ' ' + date.getDate()+', ' +date.getFullYear());
       const image_url = item.image_url;
       $("#magazineposts").append("<div class='card'><a href='"+postlink+"'><img src='"+image_url+"' class='card-img-top'></a><div class='card-body font-weight-bold '><a class='text-dark' href='"+postlink+"'>"+posttitle+"</a><div><small>"+postdate+"</small></div></div></div>");
    });
  });
});
