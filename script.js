function beli(produk){

alert("Anda memilih: " + produk)

document.getElementById("order").scrollIntoView()

}

document.getElementById("contactForm").addEventListener("submit",function(e){

e.preventDefault()

let nama=document.getElementById("nama").value
let pesan=document.getElementById("pesan").value

let data={
nama:nama,
pesan:pesan
}

let list=JSON.parse(localStorage.getItem("masukan"))||[]

list.push(data)

localStorage.setItem("masukan",JSON.stringify(list))

alert("Masukan tersimpan")

})